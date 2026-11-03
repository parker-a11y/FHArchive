/**
 * Reads a book's records straight from the archive (read-only). Nothing here
 * writes to letters, scans or transcriptions — books only reference them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { readableRecordTranscription } from "@/lib/combined-transcription.server";
import type { BookImage, BookMeta, BookRecordSource, BookSettings, BookWarning } from "./types";

type Db = SupabaseClient<any, "public", any>;

const isEnvelope = (f: { label: string | null; original_filename: string | null }) =>
  /envelope/i.test(`${f.label ?? ""} ${f.original_filename ?? ""}`);

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeSettings(raw: unknown): BookSettings {
  const s = (raw ?? {}) as Partial<BookSettings>;
  return { scansPerPage: s.scansPerPage === 2 ? 2 : 1, titlePage: s.titlePage !== false };
}

async function inChunks<T>(ids: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 80) out.push(...(await fn(ids.slice(i, i + 80))));
  return out;
}

function dateLabel(l: { date_as_written: string | null; normalized_date: string | null }) {
  const written = l.date_as_written?.trim();
  if (written && written.toUpperCase() !== "NONE") return written;
  if (l.normalized_date) {
    const d = new Date(`${l.normalized_date}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }
  return null;
}

export type LoadedBook = {
  meta: BookMeta;
  records: BookRecordSource[];
  warnings: BookWarning[];
  items: Array<{ id: string; position: number; letter_id: string | null; source_fingerprint: string | null }>;
};

export async function loadBook(db: Db, bookId: string, opts: { previewUrls?: boolean } = {}): Promise<LoadedBook> {
  const { data: book, error } = await db.from("book_projects").select("*").eq("id", bookId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!book) throw new Error("Book not found");
  const { data: itemRows, error: iErr } = await db
    .from("book_items")
    .select("id, position, letter_id, source_fingerprint")
    .eq("book_id", bookId)
    .order("position", { ascending: true });
  if (iErr) throw new Error(iErr.message);
  const items = (itemRows ?? []) as LoadedBook["items"];
  const letterIds = [...new Set(items.map((i) => i.letter_id).filter(Boolean) as string[])];

  const letters = await inChunks(letterIds, async (c) => {
    const { data, error: e } = await db
      .from("letters")
      .select("id, archive_id, title, date_as_written, normalized_date, sort_date, author, recipient, dateline, origin, has_envelope, transcription_verified, transcription_raw_ai, updated_at")
      .in("id", c);
    if (e) throw new Error(e.message);
    return data ?? [];
  });
  const files = await inChunks(letterIds, async (c) => {
    const { data, error: e } = await db
      .from("digital_files")
      .select("id, letter_id, sort_order, label, original_filename, master_path, master_mime, rotation, include_in_transcription, updated_at")
      .in("letter_id", c)
      .order("sort_order", { ascending: true });
    if (e) throw new Error(e.message);
    return data ?? [];
  });
  const derivs = await inChunks(letterIds, async (c) => {
    const { data, error: e } = await db
      .from("file_derivatives")
      .select("id, file_id, kind, status, storage_path, width, height, updated_at")
      .in("letter_id", c);
    if (e) throw new Error(e.message);
    return data ?? [];
  });

  const byLetter = new Map(letters.map((l: any) => [l.id, l]));
  const derivByFile = new Map<string, any[]>();
  for (const d of derivs as any[]) {
    if (d.status !== "complete" || !d.storage_path) continue;
    const list = derivByFile.get(d.file_id) ?? [];
    list.push(d);
    derivByFile.set(d.file_id, list);
  }

  const warnings: BookWarning[] = [];
  const records: BookRecordSource[] = [];
  const toSign: string[] = [];

  for (const item of items) {
    const l: any = item.letter_id ? byLetter.get(item.letter_id) : null;
    if (!l) {
      warnings.push({ level: "error", archiveId: null, itemId: item.id, message: "This record is no longer in the archive. Remove it from the book." });
      continue;
    }
    const recFiles = (files as any[]).filter((f) => f.letter_id === l.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const scans: BookImage[] = [];
    const envelopes: BookImage[] = [];
    let thumbPath: string | null = null;
    for (const f of recFiles) {
      const ds = derivByFile.get(f.id) ?? [];
      const print = ds.find((d) => d.kind === "print");
      const view = ds.find((d) => d.kind === "jpeg");
      const thumb = ds.find((d) => d.kind === "thumbnail");
      const label = (f.label ?? "").trim() || f.original_filename || "Scan";
      let img: BookImage | null = null;
      if (print) img = { fileId: f.id, label, path: print.storage_path, source: "print", derivativeId: print.id, width: print.width ?? 0, height: print.height ?? 0 };
      else if (view) img = { fileId: f.id, label, path: view.storage_path, source: "view", derivativeId: view.id, width: view.width ?? 0, height: view.height ?? 0 };
      else if (/jpe?g/i.test(f.master_mime ?? "")) img = { fileId: f.id, label, path: f.master_path, source: "master", derivativeId: null, width: 0, height: 0 };
      if (!img) {
        warnings.push({ level: "warning", archiveId: l.archive_id, itemId: item.id, message: `${label}: no printable image yet (no viewing copy), so it is left out.` });
        continue;
      }
      if (opts.previewUrls) {
        (img as BookImage & { _preview?: string }).previewUrl = view?.storage_path ?? img.path;
        toSign.push(view?.storage_path ?? img.path);
      }
      if (!thumbPath && thumb && !isEnvelope(f)) thumbPath = thumb.storage_path;
      (isEnvelope(f) ? envelopes : scans).push(img);
    }

    const rawText = (l.transcription_verified as string | null) ?? (l.transcription_raw_ai as string | null);
    const transcription = (await readableRecordTranscription(db, l.id, rawText)) || "";
    const verified = !!(l.transcription_verified as string | null)?.trim();

    const fingerprint = (
      await sha256(
        JSON.stringify({
          l: [l.archive_id, l.title, l.date_as_written, l.normalized_date, l.author, l.recipient, l.dateline, l.origin],
          t: transcription,
          v: verified,
          f: recFiles.map((f) => [f.id, f.sort_order, f.label, f.rotation, f.include_in_transcription, f.master_path]),
          d: (derivs as any[]).filter((d) => d.kind !== "print" && recFiles.some((f) => f.id === d.file_id)).map((d) => [d.id, d.storage_path, d.width, d.height]).sort(),
        }),
      )
    ).slice(0, 32);

    if (!scans.length) warnings.push({ level: "warning", archiveId: l.archive_id, itemId: item.id, message: "No letter scans are available." });
    if (l.has_envelope && !envelopes.length) warnings.push({ level: "warning", archiveId: l.archive_id, itemId: item.id, message: "Recorded as having an envelope, but no envelope scan exists. No envelope will be shown." });
    if (!transcription.trim()) warnings.push({ level: "warning", archiveId: l.archive_id, itemId: item.id, message: "No transcription yet." });
    else if (!verified) warnings.push({ level: "info", archiveId: l.archive_id, itemId: item.id, message: "Transcription has not been human-verified; it is printed as an AI draft and labelled that way." });
    const viewOnly = [...scans, ...envelopes].filter((s) => s.source !== "print").length;
    if (viewOnly) warnings.push({ level: "info", archiveId: l.archive_id, itemId: item.id, message: `${viewOnly} image(s) still use the 2400-pixel viewing copy. Prepare print copies for full resolution.` });
    if (item.source_fingerprint && item.source_fingerprint !== fingerprint)
      warnings.push({ level: "error", archiveId: l.archive_id, itemId: item.id, message: "This record changed in the archive after it was added. Review and refresh it before exporting." });

    records.push({
      itemId: item.id,
      letterId: l.id,
      archiveId: l.archive_id,
      dateLabel: dateLabel(l),
      sortDate: l.sort_date ?? l.normalized_date ?? null,
      author: l.author?.trim() || null,
      recipient: l.recipient?.trim() || null,
      location: (l.dateline && String(l.dateline).toUpperCase() !== "NONE" ? l.dateline : null) ?? l.origin ?? null,
      title: l.title ?? null,
      scans,
      envelopes,
      transcription,
      transcriptionVerified: verified,
      fingerprint,
      storedFingerprint: item.source_fingerprint,
      updatedAt: l.updated_at ?? null,
      thumbUrl: thumbPath,
      hasEnvelopeFlag: !!l.has_envelope,
    });
  }

  if (opts.previewUrls) {
    const paths = [...new Set([...toSign, ...(records.map((r) => r.thumbUrl).filter(Boolean) as string[])])];
    const signed = new Map<string, string>();
    for (let i = 0; i < paths.length; i += 100) {
      const { data } = await db.storage.from("scans").createSignedUrls(paths.slice(i, i + 100), 3600);
      for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
    for (const r of records) {
      r.thumbUrl = r.thumbUrl ? signed.get(r.thumbUrl) ?? null : null;
      for (const img of [...r.scans, ...r.envelopes]) img.previewUrl = img.previewUrl ? signed.get(img.previewUrl) ?? null : null;
    }
  }

  const meta: BookMeta = {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    trimWidthIn: Number(book.trim_width_in) || 8.5,
    trimHeightIn: Number(book.trim_height_in) || 11,
    settings: normalizeSettings(book.settings),
  };
  return { meta, records, warnings, items };
}
