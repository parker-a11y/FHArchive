/**
 * Background PDF export runner. Each call ("tick") claims one export with a
 * short lease, does a bounded amount of work, saves its progress and returns.
 * Ticks come from the every-minute scheduler and, while the editor is open,
 * from the page itself — the export never depends on a browser staying open.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPlan } from "./layout";
import { BOOK_FONT_FILES, createBookFonts } from "./fonts";
import { loadBook, sha256 } from "./sources.server";
import { PartBuilder, imageObjectDict, readJpegInfo, writeHead, writeXref, type ImageSlot } from "./pdf-writer";
import type { FontKey } from "./types";

type Db = SupabaseClient<any, "public", any>;
const BUCKET = "book-exports";
const PART_LIMIT = 24 * 1024 * 1024;
const MAX_ATTEMPTS = 4;

export type ExportState = {
  phase?: "plan" | "images" | "finish";
  parts?: Array<{ path: string; size: number; objects: Array<[number, number]> }>;
  images?: ImageSlot[];
  nextImage?: number;
  totalObjects?: number;
  rootNum?: number;
  infoNum?: number;
};

let fontCache: Record<FontKey, Uint8Array> | null = null;
async function loadFontBytes(db: Db) {
  if (fontCache) return fontCache;
  const out = {} as Record<FontKey, Uint8Array>;
  for (const [k, file] of Object.entries(BOOK_FONT_FILES) as Array<[FontKey, string]>) {
    const { data, error } = await db.storage.from(BUCKET).download(`_fonts/${file}`);
    if (error || !data) throw new Error(`Book typeface could not be loaded (${file})`);
    out[k] = new Uint8Array(await data.arrayBuffer());
  }
  fontCache = out;
  return out;
}

async function upload(db: Db, path: string, bytes: Uint8Array) {
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "application/octet-stream", upsert: true });
  if (error) throw new Error(`Saving export data failed: ${error.message}`);
}

async function claim(db: Db, exportId?: string) {
  const now = new Date();
  let q = db.from("book_exports").select("id").in("status", ["queued", "running"]).or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`).order("created_at").limit(1);
  if (exportId) q = q.eq("id", exportId);
  const { data } = await q;
  const id = data?.[0]?.id as string | undefined;
  if (!id) return null;
  const lease = new Date(now.getTime() + 120_000).toISOString();
  const { data: claimed } = await db
    .from("book_exports")
    .update({ lease_until: lease, status: "running", updated_at: now.toISOString() })
    .eq("id", id)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("*")
    .maybeSingle();
  return claimed as any;
}

/** Runs export work until the time budget is used. Returns ids touched. */
export async function runBookExportTicks(db: Db, budgetMs: number, exportId?: string) {
  const started = Date.now();
  const touched: string[] = [];
  while (Date.now() - started < budgetMs - 3000) {
    const job = await claim(db, exportId);
    if (!job) break;
    touched.push(job.id);
    try {
      await step(db, job, started + budgetMs - 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = (job.attempts ?? 0) + 1;
      await db
        .from("book_exports")
        .update({
          attempts,
          error: message,
          status: attempts >= MAX_ATTEMPTS ? "failed" : "running",
          step: attempts >= MAX_ATTEMPTS ? "Failed" : `Retrying after an error (attempt ${attempts} of ${MAX_ATTEMPTS})`,
          lease_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      console.error("Book export tick failed", job.id, message);
      if (exportId) break;
    }
    if (exportId) {
      const { data } = await db.from("book_exports").select("status").eq("id", exportId).maybeSingle();
      if (!data || data.status === "done" || data.status === "failed") break;
    }
  }
  return touched;
}

async function save(db: Db, id: string, patch: Record<string, unknown>) {
  const { error } = await db.from("book_exports").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

async function step(db: Db, job: any, deadline: number) {
  const state = (job.state ?? {}) as ExportState;
  const phase = state.phase ?? "plan";

  if (phase === "plan") {
    await save(db, job.id, { step: "Laying out pages" });
    const book = await loadBook(db, job.book_id);
    const stale = book.warnings.filter((w) => w.level === "error");
    if (stale.length) {
      await save(db, job.id, { status: "failed", step: "Blocked", error: stale.map((w) => `${w.archiveId ?? ""} ${w.message}`.trim()).join("\n"), lease_until: null });
      return;
    }
    const fonts = createBookFonts(await loadFontBytes(db));
    const plan = buildPlan(book.meta, book.records, fonts);
    const head = await writeHead(plan, fonts, { title: book.meta.title, subtitle: book.meta.subtitle });
    const path = `exports/${job.id}/part-000.bin`;
    await upload(db, path, head.bytes);

    const manifest = {
      generated_at: new Date().toISOString(),
      profile: "standard-8.5x11",
      trim_in: [book.meta.trimWidthIn, book.meta.trimHeightIn],
      settings: book.meta.settings,
      page_count: plan.pages.length,
      records: await Promise.all(
        book.records.map(async (r) => ({
          archive_id: r.archiveId,
          letter_id: r.letterId,
          source_fingerprint: r.fingerprint,
          record_updated_at: r.updatedAt,
          transcription_sha256: await sha256(r.transcription),
          transcription_chars: r.transcription.length,
          transcription_verified: r.transcriptionVerified,
          pages: plan.pages.filter((p) => p.itemId === r.itemId).map((p) => p.index),
          images: [...r.scans, ...r.envelopes].map((i) => ({ file_id: i.fileId, label: i.label, source: i.source, derivative_id: i.derivativeId, path: i.path, px: [i.width, i.height] })),
        })),
      ),
    };
    const images = head.images;
    await save(db, job.id, {
      step: images.length ? `Embedding scans (0 of ${images.length})` : "Finishing",
      progress: 1,
      total: images.length + 2,
      page_count: plan.pages.length,
      manifest,
      warnings: [...book.warnings, ...plan.warnings],
      state: {
        phase: images.length ? "images" : "finish",
        parts: [{ path, size: head.bytes.length, objects: head.objects }],
        images,
        nextImage: 0,
        totalObjects: head.totalObjects,
        rootNum: head.rootNum,
        infoNum: head.infoNum,
      } satisfies ExportState,
    });
    return;
  }

  if (phase === "images") {
    const images = state.images ?? [];
    let i = state.nextImage ?? 0;
    const part = new PartBuilder();
    while (i < images.length && part.size < PART_LIMIT && (Date.now() < deadline || part.size === 0)) {
      const slot = images[i];
      const { data, error } = await db.storage.from("scans").download(slot.path);
      if (error || !data) throw new Error(`Scan could not be read: ${slot.path}`);
      const bytes = new Uint8Array(await data.arrayBuffer());
      const info = readJpegInfo(bytes);
      if (!info) throw new Error(`Scan is not a readable JPEG: ${slot.path}`);
      part.stream(slot.num, imageObjectDict(info), bytes);
      i++;
    }
    const parts = [...(state.parts ?? [])];
    const path = `exports/${job.id}/part-${String(parts.length).padStart(3, "0")}.bin`;
    await upload(db, path, part.bytes());
    parts.push({ path, size: part.size, objects: part.objects });
    const done = i >= images.length;
    await save(db, job.id, {
      progress: 1 + i,
      step: done ? "Finishing" : `Embedding scans (${i} of ${images.length})`,
      lease_until: done ? job.lease_until : null,
      state: { ...state, parts, nextImage: i, phase: done ? "finish" : "images" },
    });
    if (!done) return;
    state.parts = parts;
    state.phase = "finish";
  }

  // finish
  const parts = state.parts ?? [];
  const offsets = new Map<number, number>();
  let base = 0;
  for (const p of parts) {
    for (const [num, off] of p.objects) offsets.set(num, base + off);
    base += p.size;
  }
  const id = (await sha256(job.id)).slice(0, 32);
  const xref = writeXref(state.totalObjects ?? 0, offsets, base, state.rootNum ?? 1, state.infoNum ?? 3, id);
  const path = `exports/${job.id}/part-${String(parts.length).padStart(3, "0")}.bin`;
  await upload(db, path, xref);
  const finalParts = [...parts, { path, size: xref.length, objects: [] }];
  await save(db, job.id, {
    status: "done",
    step: "Ready",
    progress: job.total || 1,
    error: null,
    lease_until: null,
    file_size: base + xref.length,
    finished_at: new Date().toISOString(),
    state: { ...state, parts: finalParts, phase: "finish" },
  });
}

// ---- signed download links -------------------------------------------------

async function hmac(text: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`book-export:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signDownload(exportId: string, ttlSeconds = 900) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `/api/public/book-export-download?id=${exportId}&exp=${exp}&sig=${await hmac(`${exportId}.${exp}`)}`;
}

export async function verifyDownload(id: string, exp: string, sig: string) {
  if (!id || !exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const expected = await hmac(`${id}.${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
