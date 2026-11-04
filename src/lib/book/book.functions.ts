import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = z.string().uuid();

async function assertEditor(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("can_edit_archive", { _user_id: ctx.userId });
  if (!data) throw new Error("Book Builder is available to administrators and archivists.");
}

export const listBooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const { data, error } = await db.from("book_projects").select("id, title, subtitle, description, updated_at, created_at").order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((b: any) => b.id);
    const { data: items } = ids.length ? await db.from("book_items").select("book_id").in("book_id", ids) : { data: [] };
    const { data: exports } = ids.length
      ? await db.from("book_exports").select("book_id, status, page_count, created_at").in("book_id", ids).order("created_at", { ascending: false })
      : { data: [] };
    return (data ?? []).map((b: any) => ({
      ...b,
      records: (items ?? []).filter((i: any) => i.book_id === b.id).length,
      lastExport: (exports ?? []).find((e: any) => e.book_id === b.id) ?? null,
    }));
  });

export const createBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().trim().min(1).max(200), subtitle: z.string().trim().max(300).optional(), description: z.string().max(4000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { data: row, error } = await context.supabase
      .from("book_projects")
      .insert({ title: data.title, subtitle: data.subtitle || null, description: data.description || null, settings: { scansPerPage: 1, titlePage: true, envelopeFirst: true } })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id,
        title: z.string().trim().min(1).max(200).optional(),
        subtitle: z.string().trim().max(300).nullable().optional(),
        description: z.string().max(4000).nullable().optional(),
        settings: z.object({ scansPerPage: z.union([z.literal(1), z.literal(2)]), titlePage: z.boolean(), envelopeFirst: z.boolean().optional() }).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { id: bookId, ...patch } = data;
    const { error } = await context.supabase.from("book_projects").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", bookId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { error } = await context.supabase.from("book_projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const { data: b, error } = await db.from("book_projects").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: copy, error: cErr } = await db
      .from("book_projects")
      .insert({ title: `${b.title} (copy)`, subtitle: b.subtitle, description: b.description, theme: b.theme, trim_width_in: b.trim_width_in, trim_height_in: b.trim_height_in, orientation: b.orientation, settings: b.settings, saved_custom_order: null })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    const { data: items } = await db.from("book_items").select("position, item_type, letter_id, page_doc, options, source_fingerprint").eq("book_id", data.id);
    if (items?.length) {
      const { error: iErr } = await db.from("book_items").insert(items.map((i: any) => ({ ...i, book_id: copy.id, source_checked_at: new Date().toISOString() })));
      if (iErr) throw new Error(iErr.message);
    }
    return { id: copy.id as string };
  });

export const getBookEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { loadBook } = await import("./sources.server");
    const db = context.supabase;
    const loaded = await loadBook(db, data.id, { previewUrls: true });
    const { data: book } = await db.from("book_projects").select("description, saved_custom_order, updated_at").eq("id", data.id).single();
    const { data: exports } = await db
      .from("book_exports")
      .select("id, status, progress, total, step, error, attempts, page_count, file_size, warnings, created_at, finished_at")
      .eq("book_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return {
      ...loaded,
      description: (book?.description as string | null) ?? null,
      hasSavedOrder: Array.isArray(book?.saved_custom_order) && (book!.saved_custom_order as unknown[]).length > 0,
      exports: exports ?? [],
    };
  });

export const addBookRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: id, archiveIds: z.array(z.string()).max(1000).optional(), letterIds: z.array(id).max(1000).optional(), atPosition: z.number().int().min(0).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const found: Array<{ id: string; archive_id: string }> = [];
    const wanted = data.archiveIds ?? [];
    for (let i = 0; i < wanted.length; i += 100) {
      const { data: rows } = await db.from("letters").select("id, archive_id, record_type").in("archive_id", wanted.slice(i, i + 100)).neq("record_type", "moved_to_gallery");
      found.push(...((rows ?? []) as any[]));
    }
    const lids = data.letterIds ?? [];
    for (let i = 0; i < lids.length; i += 100) {
      const { data: rows } = await db.from("letters").select("id, archive_id").in("id", lids.slice(i, i + 100));
      found.push(...((rows ?? []) as any[]));
    }
    const notFound = wanted.filter((a) => !found.some((f) => f.archive_id === a));
    const { data: existing } = await db.from("book_items").select("id, letter_id, position").eq("book_id", data.bookId).order("position");
    const have = new Set((existing ?? []).map((e: any) => e.letter_id));
    const order = new Map(wanted.map((a, i) => [a, i]));
    const fresh = [...new Map(found.map((f) => [f.id, f])).values()]
      .filter((f) => !have.has(f.id))
      .sort((a, b) => (order.get(a.archive_id) ?? 0) - (order.get(b.archive_id) ?? 0));
    const already = found.length - fresh.length;
    if (fresh.length) {
      const { loadBook } = await import("./sources.server");
      const rows = fresh.map((f) => ({ book_id: data.bookId, letter_id: f.id, item_type: "record", position: 0 }));
      const { data: inserted, error } = await db.from("book_items").insert(rows).select("id, letter_id");
      if (error) throw new Error(error.message);
      // Place them, then record the source revision each was added at.
      const ids = (existing ?? []).map((e: any) => e.id as string);
      const newIds = fresh.map((f) => (inserted ?? []).find((r: any) => r.letter_id === f.id)?.id as string);
      const at = data.atPosition === undefined ? ids.length : Math.min(data.atPosition, ids.length);
      ids.splice(at, 0, ...newIds);
      await writeOrder(db, ids);
      const loaded = await loadBook(db, data.bookId);
      for (const r of loaded.records)
        if (newIds.includes(r.itemId)) await db.from("book_items").update({ source_fingerprint: r.fingerprint, source_checked_at: new Date().toISOString() }).eq("id", r.itemId);
    }
    await db.from("book_projects").update({ updated_at: new Date().toISOString() }).eq("id", data.bookId);
    return { added: fresh.length, already, notFound };
  });

async function writeOrder(db: any, itemIds: string[]) {
  for (let i = 0; i < itemIds.length; i++) {
    const { error } = await db.from("book_items").update({ position: i }).eq("id", itemIds[i]);
    if (error) throw new Error(error.message);
  }
}

export const reorderBookItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: id, itemIds: z.array(id).max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const { data: existing } = await db.from("book_items").select("id").eq("book_id", data.bookId);
    const valid = new Set((existing ?? []).map((e: any) => e.id));
    if (data.itemIds.length !== valid.size || data.itemIds.some((i) => !valid.has(i))) throw new Error("The book changed in another window. Reload and try again.");
    await writeOrder(db, data.itemIds);
    await db.from("book_projects").update({ updated_at: new Date().toISOString() }).eq("id", data.bookId);
    return { ok: true };
  });

export const sortBookItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: id, mode: z.enum(["oldest", "newest", "restore"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const { data: items } = await db.from("book_items").select("id, letter_id, position").eq("book_id", data.bookId).order("position");
    const all = (items ?? []) as Array<{ id: string; letter_id: string | null }>;
    // Custom pages keep their exact slots; only letters are re-sorted around them.
    const list = all.filter((i) => i.letter_id) as Array<{ id: string; letter_id: string }>;
    const placeInto = (sortedRecords: string[]) => {
      let k = 0;
      return all.map((i) => (i.letter_id ? sortedRecords[k++] : i.id));
    };
    const { data: book } = await db.from("book_projects").select("saved_custom_order").eq("id", data.bookId).single();
    if (data.mode === "restore") {
      const saved = (book?.saved_custom_order ?? []) as string[];
      const known = saved.filter((s) => all.some((l) => l.id === s));
      const rest = all.map((l) => l.id).filter((x) => !known.includes(x));
      await writeOrder(db, [...known, ...rest]);
      return { ok: true };
    }
    const { data: letters } = await db.from("letters").select("id, sort_date, normalized_date, fh_seq").in("id", list.map((l) => l.letter_id));
    const key = new Map((letters ?? []).map((l: any) => [l.id, l]));
    const sorted = [...list].sort((a, b) => {
      const la: any = key.get(a.letter_id);
      const lb: any = key.get(b.letter_id);
      const da = la?.sort_date ?? la?.normalized_date ?? "9999";
      const dbb = lb?.sort_date ?? lb?.normalized_date ?? "9999";
      const c = String(da).localeCompare(String(dbb)) || (la?.fh_seq ?? 0) - (lb?.fh_seq ?? 0);
      return data.mode === "oldest" ? c : -c;
    });
    // Keep the custom order so it can be restored later.
    await db.from("book_projects").update({ saved_custom_order: all.map((l) => l.id), updated_at: new Date().toISOString() }).eq("id", data.bookId);
    await writeOrder(db, placeInto(sorted.map((s) => s.id)));
    return { ok: true };
  });

export const removeBookItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { error } = await context.supabase.from("book_items").delete().eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshBookSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: id, itemIds: z.array(id).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { loadBook } = await import("./sources.server");
    const loaded = await loadBook(context.supabase, data.bookId);
    let n = 0;
    for (const r of loaded.records) {
      if (data.itemIds && !data.itemIds.includes(r.itemId)) continue;
      if (r.storedFingerprint === r.fingerprint) continue;
      await context.supabase.from("book_items").update({ source_fingerprint: r.fingerprint, source_checked_at: new Date().toISOString() }).eq("id", r.itemId);
      n++;
    }
    for (const p of loaded.pages) {
      if (data.itemIds && !data.itemIds.includes(p.itemId)) continue;
      if (p.storedFingerprint === p.fingerprint) continue;
      await context.supabase.from("book_items").update({ source_fingerprint: p.fingerprint, source_checked_at: new Date().toISOString() }).eq("id", p.itemId);
      n++;
    }
    return { refreshed: n };
  });

export const searchBookCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        text: z.string().max(200).optional(),
        from: z.string().max(200).optional(),
        to: z.string().max(200).optional(),
        location: z.string().max(200).optional(),
        dateFrom: z.string().max(10).optional(),
        dateTo: z.string().max(10).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const clean = (s?: string) => (s ?? "").replace(/[%,()]/g, " ").trim();
    let q = context.supabase
      .from("letters")
      .select("id, archive_id, title, date_as_written, normalized_date, author, recipient, origin, dateline, image_count, has_envelope, transcription_verified, transcription_raw_ai, fh_seq")
      .neq("record_type", "moved_to_gallery")
      .order("sort_date", { ascending: true, nullsFirst: false })
      .limit(300);
    if (clean(data.text)) {
      const t = clean(data.text);
      q = q.or(`title.ilike.%${t}%,archive_id.ilike.%${t}%,summary_short.ilike.%${t}%`);
    }
    if (clean(data.from)) q = q.ilike("author", `%${clean(data.from)}%`);
    if (clean(data.to)) q = q.ilike("recipient", `%${clean(data.to)}%`);
    if (clean(data.location)) {
      const t = clean(data.location);
      q = q.or(`origin.ilike.%${t}%,dateline.ilike.%${t}%,destination.ilike.%${t}%`);
    }
    if (data.dateFrom) q = q.gte("normalized_date", data.dateFrom);
    if (data.dateTo) q = q.lte("normalized_date", data.dateTo);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      archiveId: r.archive_id as string,
      title: r.title as string | null,
      date: (r.date_as_written as string | null) ?? (r.normalized_date as string | null),
      author: r.author as string | null,
      recipient: r.recipient as string | null,
      location: (r.dateline as string | null) ?? (r.origin as string | null),
      scans: (r.image_count as number | null) ?? null,
      hasEnvelope: !!r.has_envelope,
      hasTranscription: !!(r.transcription_verified || r.transcription_raw_ai),
    }));
  });

export const startBookExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { loadBook } = await import("./sources.server");
    const loaded = await loadBook(context.supabase, data.bookId);
    const blocking = loaded.warnings.filter((w) => w.level === "error");
    if (blocking.length) throw new Error("Some records changed in the archive or are missing. Review and refresh them before exporting.");
    if (!loaded.entries.length) throw new Error("Add at least one record or page before exporting.");
    const { data: row, error } = await context.supabase.from("book_exports").insert({ book_id: data.bookId, profile: "standard", status: "queued", step: "Waiting to start" }).select("id").single();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runBookExportTicks } = await import("./export.server");
    await runBookExportTicks(supabaseAdmin as any, 20_000, row.id);
    return { id: row.id as string };
  });

/** Lets an open editor speed up its own export; the scheduler continues regardless. */
export const advanceBookExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ exportId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { data: row } = await context.supabase.from("book_exports").select("id, status").eq("id", data.exportId).maybeSingle();
    if (!row) throw new Error("Export not found");
    if (row.status === "queued" || row.status === "running") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { runBookExportTicks } = await import("./export.server");
      await runBookExportTicks(supabaseAdmin as any, 25_000, data.exportId);
    }
    const { data: fresh } = await context.supabase.from("book_exports").select("id, status, progress, total, step, error, attempts, page_count, file_size").eq("id", data.exportId).single();
    return fresh;
  });

export const retryBookExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ exportId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { data: row } = await context.supabase.from("book_exports").select("status, step").eq("id", data.exportId).single();
    // A blocked export (changed sources) restarts from layout; others resume where they stopped.
    const patch: any = { status: "queued", attempts: 0, error: null, lease_until: null, step: "Waiting to restart" };
    if (row?.step === "Blocked") patch.state = {};
    const { error } = await context.supabase.from("book_exports").update(patch).eq("id", data.exportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBookExportLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ exportId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { data: row } = await context.supabase.from("book_exports").select("id, status").eq("id", data.exportId).maybeSingle();
    if (!row || row.status !== "done") throw new Error("This export is not ready yet.");
    const { signDownload } = await import("./export.server");
    return { url: await signDownload(data.exportId) };
  });

export const getExportManifest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ exportId: id }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { data: row } = await context.supabase.from("book_exports").select("manifest").eq("id", data.exportId).maybeSingle();
    return row?.manifest ?? null;
  });

// ---- Phase 2: custom pages --------------------------------------------------

const num = z.number().finite().min(-2000).max(4000);
const imageRef = z.union([
  z.object({ source: z.literal("archive"), fileId: id, archiveId: z.string().max(40).optional(), label: z.string().max(300).optional(), w: z.number().optional(), h: z.number().optional() }),
  z.object({ source: z.literal("gallery"), photoId: id, side: z.enum(["front", "back"]), label: z.string().max(300).optional(), w: z.number().optional(), h: z.number().optional() }),
  z.object({ source: z.literal("upload"), path: z.string().max(500).regex(/^pages\//), viewPath: z.string().max(500).regex(/^pages\//), name: z.string().max(300).optional(), w: z.number(), h: z.number() }),
]);
const pageBox = z.union([
  z.object({ id: z.string().max(60), kind: z.literal("text"), x: num, y: num, w: num, h: num, z: z.number().optional(), text: z.string().max(60000), style: z.enum(["heading", "body", "caption", "quote", "note"]), align: z.enum(["left", "center", "right"]), bold: z.boolean().optional(), italic: z.boolean().optional() }),
  z.object({ id: z.string().max(60), kind: z.literal("image"), x: num, y: num, w: num, h: num, z: z.number().optional(), ref: imageRef.nullable(), mode: z.enum(["fit", "fill", "bleed"]), caption: z.string().max(1000).optional() }),
]);
const pageDoc = z.object({
  template: z.string().max(40),
  name: z.string().max(120).optional(),
  folio: z.boolean(),
  boxes: z.array(pageBox).max(60),
  flow: z.object({ heading: z.string().max(300).optional(), text: z.string().max(400000) }).nullable().optional(),
});

async function stampPage(db: any, itemId: string) {
  const { resolvePageEntries } = await import("./sources.server");
  const { data: row } = await db.from("book_items").select("id, page_doc, source_fingerprint").eq("id", itemId).single();
  const [p] = await resolvePageEntries(db, [row]);
  if (p) await db.from("book_items").update({ source_fingerprint: p.fingerprint, source_checked_at: new Date().toISOString() }).eq("id", itemId);
}

export const addCustomPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bookId: id, template: z.string().max(40), atPosition: z.number().int().min(0).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const { makeTemplate } = await import("./templates");
    const doc = makeTemplate(data.template);
    const { data: row, error } = await db.from("book_items").insert({ book_id: data.bookId, item_type: "page", letter_id: null, page_doc: doc, position: 0 }).select("id").single();
    if (error) throw new Error(error.message);
    const { data: existing } = await db.from("book_items").select("id").eq("book_id", data.bookId).neq("id", row.id).order("position");
    const ids = (existing ?? []).map((e: any) => e.id as string);
    const at = data.atPosition === undefined ? ids.length : Math.min(data.atPosition, ids.length);
    ids.splice(at, 0, row.id);
    await writeOrder(db, ids);
    await stampPage(db, row.id);
    await db.from("book_projects").update({ updated_at: new Date().toISOString() }).eq("id", data.bookId);
    return { id: row.id as string };
  });

export const saveCustomPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ itemId: id, doc: pageDoc }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const { data: row, error } = await db.from("book_items").update({ page_doc: data.doc }).eq("id", data.itemId).eq("item_type", "page").select("book_id").single();
    if (error) throw new Error(error.message);
    await stampPage(db, data.itemId);
    await db.from("book_projects").update({ updated_at: new Date().toISOString() }).eq("id", row.book_id);
    return { ok: true };
  });

/** Scans and envelopes of one FH record, for the custom-page image picker (read-only). */
export const listArchiveImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ archiveId: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const { parseArchiveIds } = await import("./ids");
    const aid = parseArchiveIds(data.archiveId)[0] ?? data.archiveId.toUpperCase();
    const { data: l } = await db.from("letters").select("id, archive_id, title").eq("archive_id", aid).maybeSingle();
    if (!l) return { archiveId: aid, found: false, images: [] as Array<{ fileId: string; label: string; url: string | null; w: number; h: number }> };
    const { data: files } = await db.from("digital_files").select("id, label, original_filename, sort_order").eq("letter_id", l.id).order("sort_order");
    const { data: ds } = await db.from("file_derivatives").select("file_id, kind, status, storage_path, width, height").eq("letter_id", l.id).eq("status", "complete");
    const rows = (files ?? []).map((f: any) => {
      const mine = (ds ?? []).filter((d: any) => d.file_id === f.id);
      const view = mine.find((d: any) => d.kind === "jpeg");
      const thumb = mine.find((d: any) => d.kind === "thumbnail") ?? view;
      const print = mine.find((d: any) => d.kind === "print");
      return { fileId: f.id as string, label: ((f.label ?? "").trim() || f.original_filename || "Scan") as string, thumb: thumb?.storage_path as string | undefined, w: (print?.width ?? view?.width ?? 0) as number, h: (print?.height ?? view?.height ?? 0) as number };
    });
    const paths = rows.map((r) => r.thumb).filter(Boolean) as string[];
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: s } = await db.storage.from("scans").createSignedUrls(paths, 3600);
      for (const x of s ?? []) if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl);
    }
    return { archiveId: l.archive_id as string, found: true, images: rows.map((r) => ({ fileId: r.fileId, label: r.label, url: r.thumb ? signed.get(r.thumb) ?? null : null, w: r.w, h: r.h })) };
  });

/** Photo Gallery items for the image picker (read-only). */
export const listGalleryImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context);
    const db = context.supabase;
    const { data } = await db.from("photos").select("id, caption, front_thumb_path, front_view_path, back_thumb_path, back_view_path, sort_order").order("sort_order", { ascending: true, nullsFirst: true }).limit(1000);
    const rows = (data ?? []) as any[];
    const paths = rows.flatMap((r) => [r.front_thumb_path ?? r.front_view_path, r.back_thumb_path ?? r.back_view_path]).filter(Boolean) as string[];
    const signed = new Map<string, string>();
    for (let i = 0; i < paths.length; i += 100) {
      const { data: s } = await db.storage.from("scans").createSignedUrls(paths.slice(i, i + 100), 3600);
      for (const x of s ?? []) if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl);
    }
    return rows.flatMap((r) => {
      const out: Array<{ photoId: string; side: "front" | "back"; label: string; url: string | null }> = [];
      if (r.front_view_path) out.push({ photoId: r.id, side: "front", label: r.caption || "Photograph", url: signed.get(r.front_thumb_path ?? r.front_view_path) ?? null });
      if (r.back_view_path) out.push({ photoId: r.id, side: "back", label: `${r.caption || "Photograph"} (back)`, url: signed.get(r.back_thumb_path ?? r.back_view_path) ?? null });
      return out;
    });
  });

/** Signs a freshly uploaded book image so the editor can show it straight away. */
export const signBookImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().max(500).regex(/^pages\//) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { data: s } = await context.supabase.storage.from("book-images").createSignedUrl(data.path, 3600);
    return { url: s?.signedUrl ?? null };
  });
