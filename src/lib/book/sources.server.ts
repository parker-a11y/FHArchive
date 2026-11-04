/**
 * Reads a book's records straight from the archive (read-only). Nothing here
 * writes to letters, scans or transcriptions — books only reference them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { readableRecordTranscription } from "@/lib/combined-transcription.server";
import type { BookEntry, BookImage, BookMeta, BookPageSource, BookRecordSource, BookSettings, BookWarning, ChapterDoc, CoverDoc, CustomPageDoc, ImageRef } from "./types";

type Db = SupabaseClient<any, "public", any>;

const isEnvelope = (f: { label: string | null; original_filename: string | null }) =>
  /envelope/i.test(`${f.label ?? ""} ${f.original_filename ?? ""}`);

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeSettings(raw: unknown): BookSettings {
  const s = (raw ?? {}) as Partial<BookSettings>;
  return {
    scansPerPage: s.scansPerPage === 2 ? 2 : 1,
    titlePage: s.titlePage !== false,
    envelopeFirst: s.envelopeFirst !== false,
    facing: s.facing === true,
    theme: typeof s.theme === "string" ? s.theme : "classic",
    printer: typeof s.printer === "string" ? s.printer : "generic",
    toc: { enabled: s.toc?.enabled === true, records: s.toc?.records === true },
    front: { colophon: s.front?.colophon === true, colophonText: typeof s.front?.colophonText === "string" ? s.front.colophonText : "", dedication: typeof s.front?.dedication === "string" ? s.front.dedication : "" },
  };
}

const clean = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t && t.toUpperCase() !== "NONE" ? t : null;
};

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
  pages: BookPageSource[];
  /** Records and custom pages in book order. */
  entries: BookEntry[];
  warnings: BookWarning[];
  items: ItemRow[];
};

type ItemRow = { id: string; position: number; item_type: string; letter_id: string | null; page_doc: unknown; source_fingerprint: string | null };

export async function loadBook(db: Db, bookId: string, opts: { previewUrls?: boolean } = {}): Promise<LoadedBook> {
  const { data: book, error } = await db.from("book_projects").select("*").eq("id", bookId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!book) throw new Error("Book not found");
  const { data: itemRows, error: iErr } = await db
    .from("book_items")
    .select("id, position, item_type, letter_id, page_doc, source_fingerprint")
    .eq("book_id", bookId)
    .order("position", { ascending: true });
  if (iErr) throw new Error(iErr.message);
  const items = (itemRows ?? []) as LoadedBook["items"];
  const letterIds = [...new Set(items.filter((i) => i.item_type === "record").map((i) => i.letter_id).filter(Boolean) as string[])];

  const letters = await inChunks(letterIds, async (c) => {
    const { data, error: e } = await db
      .from("letters")
      .select("id, archive_id, title, date_as_written, normalized_date, sort_date, author, recipient, dateline, origin, destination, has_envelope, transcription_verified, transcription_raw_ai, updated_at")
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

  // Per-scan text for the facing-page layout (read-only; not part of the source fingerprint).
  const pageRows = await inChunks(letterIds, async (c) => {
    const { data, error: e } = await db.from("scan_transcriptions").select("file_id, page_index, verified_text, ai_text").in("letter_id", c).order("page_index", { ascending: true });
    if (e) throw new Error(e.message);
    return data ?? [];
  });
  const textByFile = new Map<string, string>();
  for (const t of pageRows as any[]) {
    const text = t.verified_text?.trim() ? String(t.verified_text) : String(t.ai_text ?? "");
    if (!text.trim()) continue;
    textByFile.set(t.file_id, textByFile.has(t.file_id) ? `${textByFile.get(t.file_id)}\n\n${text}` : text);
  }
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

  const pageItems = items.filter((i) => i.item_type === "page");
  const pages = await resolvePageEntries(db, pageItems, opts);
  const pageById = new Map(pages.map((p) => [p.itemId, p]));
  const entries: BookEntry[] = [];

  for (const item of items) {
    if (item.item_type === "page") {
      const pg = pageById.get(item.id);
      if (pg) {
        entries.push(pg);
        if (pg.storedFingerprint && pg.storedFingerprint !== pg.fingerprint)
          warnings.push({ level: "error", archiveId: null, itemId: item.id, message: `${pg.doc.name || "Custom page"}: an archive image on this page changed. Open the page and save it (or refresh) to accept the current version.` });
      }
      continue;
    }
    if (item.item_type === "chapter") {
      entries.push({ type: "chapter", itemId: item.id, doc: normalizeChapter(item.page_doc) });
      continue;
    }
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

    const recEntry: BookRecordSource = {
      itemId: item.id,
      letterId: l.id,
      archiveId: l.archive_id,
      dateLabel: dateLabel(l),
      sortDate: l.sort_date ?? l.normalized_date ?? null,
      author: l.author?.trim() || null,
      recipient: l.recipient?.trim() || null,
      location: (l.dateline && String(l.dateline).toUpperCase() !== "NONE" ? l.dateline : null) ?? l.origin ?? null,
      origin: clean(l.origin),
      destination: clean(l.destination),
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
      pageTexts: Object.fromEntries(scans.flatMap((sc) => (textByFile.has(sc.fileId) ? [[sc.fileId, textByFile.get(sc.fileId)!]] : []))),
    };
    records.push(recEntry);
    entries.push(recEntry);
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
  return { meta, records, pages, entries, warnings, items };
}

// ---- custom pages ---------------------------------------------------------

export function normalizeChapter(raw: unknown): ChapterDoc {
  const d = (raw ?? {}) as Partial<ChapterDoc>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { title: str(d.title) || "Untitled chapter", subtitle: str(d.subtitle), epigraph: str(d.epigraph), epigraphSource: str(d.epigraphSource) };
}

export function normalizeCover(raw: unknown, meta: { title: string; subtitle: string | null }): CoverDoc {
  const d = (raw ?? {}) as Partial<CoverDoc>;
  const str = (v: unknown, dflt = "") => (typeof v === "string" ? v : dflt);
  return {
    template: d.template === "photo" || d.template === "cloth" ? d.template : "classic",
    title: str(d.title, meta.title),
    subtitle: str(d.subtitle, meta.subtitle ?? ""),
    author: str(d.author),
    backText: str(d.backText),
    spineText: d.spineText !== false,
    image: d.image && typeof d.image === "object" ? (d.image as ImageRef) : null,
  };
}

/** Reads a book's cover design and resolves its image (read-only). */
export async function loadCover(db: Db, bookId: string, meta: { title: string; subtitle: string | null }, opts: { previewUrls?: boolean } = {}) {
  const { data } = await db.from("book_covers").select("doc").eq("book_id", bookId).maybeSingle();
  const doc = normalizeCover(data?.doc, meta);
  let image: BookImage | null = null;
  if (doc.image) {
    const [p] = await resolvePageEntries(db, [{ id: "cover", source_fingerprint: null, page_doc: { template: "cover", folio: false, boxes: [{ id: "cover", kind: "image", x: 0, y: 0, w: 1, h: 1, ref: doc.image, mode: "fill" }] } }], opts);
    image = p?.images.cover ?? null;
  }
  return { doc, image, saved: !!data };
}

export function normalizeDoc(raw: unknown): CustomPageDoc {
  const d = (raw ?? {}) as Partial<CustomPageDoc>;
  return {
    template: typeof d.template === "string" ? d.template : "blank",
    name: typeof d.name === "string" ? d.name : undefined,
    folio: d.folio !== false,
    boxes: Array.isArray(d.boxes) ? d.boxes : [],
    flow: d.flow && typeof d.flow === "object" ? { heading: d.flow.heading ?? "", text: d.flow.text ?? "" } : null,
  };
}

/** Resolves the archive/gallery/upload images used on custom pages (read-only). */
export async function resolvePageEntries(db: Db, items: Array<Pick<ItemRow, "id" | "page_doc" | "source_fingerprint">>, opts: { previewUrls?: boolean } = {}): Promise<BookPageSource[]> {
  const docs = items.map((i) => ({ item: i, doc: normalizeDoc(i.page_doc) }));
  const refs = docs.flatMap((d) => d.doc.boxes.flatMap((b) => (b.kind === "image" && b.ref ? [b.ref] : [])));
  const fileIds = [...new Set(refs.flatMap((r) => (r.source === "archive" ? [r.fileId] : [])))];
  const photoIds = [...new Set(refs.flatMap((r) => (r.source === "gallery" ? [r.photoId] : [])))];
  const files = await inChunks(fileIds, async (c) => {
    const { data, error } = await db.from("digital_files").select("id, label, original_filename, master_path, master_mime").in("id", c);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const derivs = await inChunks(fileIds, async (c) => {
    const { data, error } = await db.from("file_derivatives").select("id, file_id, kind, status, storage_path, width, height").in("file_id", c);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const photos = await inChunks(photoIds, async (c) => {
    const { data, error } = await db.from("photos").select("id, caption, front_path, front_view_path, back_path, back_view_path").in("id", c);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const fileById = new Map((files as any[]).map((f) => [f.id, f]));
  const photoById = new Map((photos as any[]).map((p) => [p.id, p]));
  const isJpeg = (p: string | null | undefined) => !!p && /\.jpe?g$/i.test(p);

  const resolve = (ref: ImageRef): (BookImage & { _view?: string }) | null => {
    if (ref.source === "upload") {
      return { fileId: ref.path, label: ref.name || "Uploaded image", path: ref.path, source: "print", derivativeId: null, width: ref.w, height: ref.h, bucket: "book-images", _view: ref.viewPath || ref.path };
    }
    if (ref.source === "gallery") {
      const p: any = photoById.get(ref.photoId);
      if (!p) return null;
      const view = ref.side === "back" ? p.back_view_path : p.front_view_path;
      const orig = ref.side === "back" ? p.back_path : p.front_path;
      const path = isJpeg(orig) && (ref.w ?? 0) > 2400 ? orig : view ?? (isJpeg(orig) ? orig : null);
      if (!path) return null;
      return { fileId: ref.photoId, label: ref.label || p.caption || "Photograph", path, source: path === orig ? "master" : "view", derivativeId: null, width: ref.w ?? 0, height: ref.h ?? 0, bucket: "scans", _view: view ?? path };
    }
    const f: any = fileById.get(ref.fileId);
    if (!f) return null;
    const ds = (derivs as any[]).filter((d) => d.file_id === f.id && d.status === "complete" && d.storage_path);
    const print = ds.find((d) => d.kind === "print");
    const view = ds.find((d) => d.kind === "jpeg");
    const label = `${ref.archiveId ? `${ref.archiveId} ` : ""}${(f.label ?? "").trim() || f.original_filename || "Scan"}`;
    if (print) return { fileId: f.id, label, path: print.storage_path, source: "print", derivativeId: print.id, width: print.width ?? 0, height: print.height ?? 0, bucket: "scans", _view: view?.storage_path ?? print.storage_path };
    if (view) return { fileId: f.id, label, path: view.storage_path, source: "view", derivativeId: view.id, width: view.width ?? ref.w ?? 0, height: view.height ?? ref.h ?? 0, bucket: "scans", _view: view.storage_path };
    if (/jpe?g/i.test(f.master_mime ?? "")) return { fileId: f.id, label, path: f.master_path, source: "master", derivativeId: null, width: ref.w ?? 0, height: ref.h ?? 0, bucket: "scans", _view: f.master_path };
    return null;
  };

  const out: BookPageSource[] = [];
  const sign: Record<"scans" | "book-images", Set<string>> = { scans: new Set(), "book-images": new Set() };
  for (const { item, doc } of docs) {
    const images: Record<string, BookImage | null> = {};
    for (const b of doc.boxes) {
      if (b.kind !== "image") continue;
      const img = b.ref ? resolve(b.ref) : null;
      images[b.id] = img;
      if (img && opts.previewUrls && img._view) sign[img.bucket ?? "scans"].add(img._view);
    }
    const fingerprint = (
      await sha256(JSON.stringify(Object.entries(images).sort().map(([k, v]) => [k, v?.path ?? null, v?.width ?? 0, v?.height ?? 0, v?.derivativeId ?? null])))
    ).slice(0, 32);
    out.push({ type: "page", itemId: item.id, doc, images, fingerprint, storedFingerprint: item.source_fingerprint });
  }
  if (opts.previewUrls) {
    for (const bucket of ["scans", "book-images"] as const) {
      const paths = [...sign[bucket]];
      const signed = new Map<string, string>();
      for (let i = 0; i < paths.length; i += 100) {
        const { data } = await db.storage.from(bucket).createSignedUrls(paths.slice(i, i + 100), 3600);
        for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      }
      for (const p of out)
        for (const img of Object.values(p.images) as Array<(BookImage & { _view?: string }) | null>)
          if (img && (img.bucket ?? "scans") === bucket && img._view) img.previewUrl = signed.get(img._view) ?? null;
    }
  }
  for (const p of out) for (const img of Object.values(p.images) as Array<(BookImage & { _view?: string }) | null>) if (img) delete img._view;
  return out;
}
