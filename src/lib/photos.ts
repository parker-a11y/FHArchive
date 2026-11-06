/**
 * Photo gallery: simple photos (front, optional back, caption, notes) that are
 * not FH records. Files live in the private `scans` bucket under `photos/`.
 */
import { supabase } from "@/integrations/supabase/client";
import { canDerive, makeDerivatives } from "@/lib/derivatives";
import { legacyPhotoNotes } from "@/lib/photo-notes";

export type Photo = {
  id: string;
  front_path: string;
  front_thumb_path: string | null;
  front_view_path: string | null;
  back_path: string | null;
  back_thumb_path: string | null;
  back_view_path: string | null;
  caption: string | null;
  notes: string | null;
  legacy_archive_id: string | null;
  created_at: string;
  sort_order: number | null;
  ph_seq: number | null;
  ph_id: string | null;
  batch_id: string | null;
  box_id: string | null;
  sleeve_id: string | null;
  people: string | null;
  date_text: string | null;
  date_year_start: number | null;
  date_year_end: number | null;
  location: string | null;
  inscription: string | null;
  info_source: string | null;
  back_transcription: string | null;
  original_filename: string | null;
};

const COLS =
  "id, front_path, front_thumb_path, front_view_path, back_path, back_thumb_path, back_view_path, caption, notes, legacy_archive_id, created_at, sort_order, ph_seq, ph_id, batch_id, box_id, sleeve_id, people, date_text, date_year_start, date_year_end, location, inscription, info_source, back_transcription, original_filename";

export async function fetchPhotos(): Promise<Photo[]> {
  const out: Photo[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("photos")
      .select(COLS)
      .order("sort_order", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Photo[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function savePhotoOrder(photos: readonly Photo[]) {
  const { error } = await supabase.rpc("reorder_photos", { ordered_ids: photos.map((p) => p.id) });
  if (error) throw error;
}

async function uploadOne(file: File): Promise<{ path: string; thumb: string | null; view: string | null }> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `photos/${Date.now()}_x${Math.random().toString(36).slice(2, 8)}_${safe}`;
  const { error } = await supabase.storage
    .from("scans")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(`${file.name}: ${error.message}`);
  let thumb: string | null = null;
  let view: string | null = null;
  if (canDerive(file)) {
    try {
      const d = await makeDerivatives(file);
      const vp = `${path}_view.jpg`;
      const rv = await supabase.storage.from("scans").upload(vp, d.view.blob, { upsert: true, contentType: "image/jpeg" });
      if (!rv.error) view = vp;
      const tp = `${path}_thumb.jpg`;
      const rt = await supabase.storage.from("scans").upload(tp, d.thumb.blob, { upsert: true, contentType: "image/jpeg" });
      if (!rt.error) thumb = tp;
    } catch {
      /* previews are optional */
    }
  }
  return { path, thumb, view };
}

export async function createPhoto(input: { front: File; back?: File | null; caption?: string; notes?: string; batchId?: string | null }) {
  const [front, back] = await Promise.all([uploadOne(input.front), input.back ? uploadOne(input.back) : null]);
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("photos").insert({
    front_path: front.path,
    front_thumb_path: front.thumb,
    front_view_path: front.view,
    back_path: back?.path ?? null,
    back_thumb_path: back?.thumb ?? null,
    back_view_path: back?.view ?? null,
    caption: input.caption?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: auth.user?.id ?? null,
    batch_id: input.batchId ?? null,
    original_filename: input.front.name,
  });
  if (error) {
    const paths = [front.path, front.thumb, front.view, back?.path, back?.thumb, back?.view].filter(Boolean) as string[];
    await supabase.storage.from("scans").remove(paths);
    throw error;
  }
}

export async function updatePhoto(id: string, patch: { caption: string; notes: string }) {
  const { error } = await supabase
    .from("photos")
    .update({ caption: patch.caption.trim() || null, notes: patch.notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Attach (or replace) the reverse-side scan on an existing photograph. */
export async function attachPhotoBack(id: string, file: File) {
  const b = await uploadOne(file);
  const { error } = await supabase
    .from("photos")
    .update({ back_path: b.path, back_thumb_path: b.thumb, back_view_path: b.view, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePhoto(p: Photo) {
  const { error } = await supabase.from("photos").delete().eq("id", p.id);
  if (error) throw error;
  // Converted FH photos still share files with their retired record; leave those.
  if (p.legacy_archive_id) return;
  const paths = [
    p.front_path,
    p.front_thumb_path,
    p.front_view_path,
    p.back_path,
    p.back_thumb_path,
    p.back_view_path,
  ].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("scans").remove(paths);
}

/** Best on-screen image: the large viewing copy, then the thumbnail, then a
 *  browser-viewable original. TIFF originals are never returned (unrenderable). */
export const viewPath = (path: string | null, thumb: string | null, view: string | null = null) =>
  view ?? thumb ?? (path && !/\.tiff?$/i.test(path) ? path : null);

/**
 * The name the visitor sees when downloading: the original filename, with the
 * upload-time prefix that the scanners and uploadOne() add stripped off
 * (`1789434441468_353.jpg` → `353.jpg`, `1793649564624_2026-11-02-0217.tif` →
 * `2026-11-02-0217.tif`).
 */
export function originalName(path: string) {
  const base = (path.split("/").pop() ?? path).replace(/_thumb\.jpg$/i, "");
  let stripped = base.replace(/^\d{10,}_/, "");
  // New uploads carry an `x<random>_` marker; photos staged in the old Unassigned
  // bucket carry a bare 6-character token. Both are upload noise, not the name.
  if (/^_unassigned\//i.test(path)) stripped = stripped.replace(/^[a-z0-9]{6}_/, "");
  else stripped = stripped.replace(/^x[a-z0-9]{1,8}_/, "");
  return stripped || base;
}



/**
 * Fetch the archival original (never the small JPEG preview) into memory so the
 * visitor can download it. The bucket is private, so this goes through a short
 * signed URL.
 */
export async function fetchPhotoOriginal(path: string): Promise<{ blob: Blob; name: string }> {
  const { data, error } = await supabase.storage.from("scans").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not open this photo");
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`Could not download this photo (${res.status})`);
  const blob = await res.blob();
  return { blob, name: originalName(path) };
}


/** How many old FH photo records / bucket photos still need moving. */
export async function pendingConversionCount() {
  const [a, b] = await Promise.all([
    supabase.from("letters").select("id", { count: "exact", head: true }).eq("record_type", "photograph"),
    supabase.from("unassigned_photos").select("id", { count: "exact", head: true }),
  ]);
  return (a.count ?? 0) + (b.count ?? 0);
}

/**
 * Move every FH photograph record and every Unassigned bucket photo into the
 * gallery. FH records are kept (hidden as "moved_to_gallery") so their numbers,
 * history and old links stay intact. Safe to run again.
 */
export async function convertExistingPhotos(): Promise<number> {
  let moved = 0;
  const { data: auth } = await supabase.auth.getUser();
  const { data: letters, error } = await supabase
    .from("letters")
    .select(
      "id, archive_id, title, date_as_written, normalized_date, photo_back_inscription, primary_person, origin, photographer, photo_occasion, storage_location, notes",
    )
    .eq("record_type", "photograph");
  if (error) throw error;
  for (const l of letters ?? []) {
    const { data: files } = await supabase
      .from("digital_files")
      .select("id, master_path, sort_order, seq")
      .eq("letter_id", l.id)
      .order("sort_order", { ascending: true })
      .order("seq", { ascending: true });
    const list = (files ?? []).filter((f) => f.master_path);
    if (!list.length) continue;
    const { data: thumbs } = await supabase
      .from("file_derivatives")
      .select("file_id, storage_path, kind")
      .in("file_id", list.map((f) => f.id));
    const thumbOf = (fid: string) =>
      thumbs?.find((t) => t.file_id === fid && t.kind === "thumbnail")?.storage_path ??
      thumbs?.find((t) => t.file_id === fid && t.kind === "jpeg")?.storage_path ??
      null;
    const [f, b] = list;
    const { error: insErr } = await supabase.from("photos").upsert(
      {
        front_path: f.master_path!,
        front_thumb_path: thumbOf(f.id),
        back_path: b?.master_path ?? null,
        back_thumb_path: b ? thumbOf(b.id) : null,
        caption: l.title?.trim() || null,
        notes: legacyPhotoNotes(l),
        legacy_archive_id: l.archive_id,
        created_by: auth.user?.id ?? null,
      },
      { onConflict: "legacy_archive_id", ignoreDuplicates: true },
    );
    if (insErr) throw new Error(`${l.archive_id}: ${insErr.message}`);
    const { error: upErr } = await supabase.from("letters").update({ record_type: "moved_to_gallery" }).eq("id", l.id);
    if (upErr) throw new Error(`${l.archive_id}: ${upErr.message}`);
    moved++;
  }
  const { data: inbox, error: inErr } = await supabase
    .from("unassigned_photos")
    .select("id, storage_path, thumb_path, original_filename, created_at");
  if (inErr) throw inErr;
  for (const p of inbox ?? []) {
    const { error: insErr } = await supabase.from("photos").upsert(
      {
        front_path: p.storage_path,
        front_thumb_path: p.thumb_path,
        legacy_source: `inbox:${p.id}`,
        created_at: p.created_at,
        created_by: auth.user?.id ?? null,
      },
      { onConflict: "legacy_source", ignoreDuplicates: true },
    );
    if (insErr) throw new Error(`${p.original_filename}: ${insErr.message}`);
    await supabase.from("unassigned_photos").delete().eq("id", p.id);
    moved++;
  }
  return moved;
}

/** Photos whose front (or back) still lacks a large viewing copy. */
export async function missingViewCount() {
  const { count, error } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .or("front_view_path.is.null,and(back_path.not.is.null,back_view_path.is.null)");
  if (error) throw error;
  return count ?? 0;
}

/**
 * Build the large (~2400 px) JPEG viewing copy for photos that predate it.
 * Downloads each original through a signed URL, derives view + thumbnail in
 * the browser, uploads them next to the master and updates the row. One bad
 * photo never stops the run — failures are collected and reported. Safe to
 * run again.
 */
export async function backfillViewCopies(
  onProgress?: (done: number, total: number) => void,
): Promise<{ done: number; failed: string[] }> {
  const photos = await fetchPhotos();
  const need = photos.filter(
    (p) => !p.front_view_path || (p.back_path && !p.back_view_path),
  );
  let done = 0;
  const failed: string[] = [];
  for (const p of need) {
    try {
      const patch: Partial<Pick<Photo, "front_view_path" | "front_thumb_path" | "back_view_path" | "back_thumb_path">> = {};
      for (const side of ["front", "back"] as const) {
        const master = side === "front" ? p.front_path : p.back_path;
        const hasView = side === "front" ? p.front_view_path : p.back_view_path;
        if (!master || hasView) continue;
        const { data: signed, error: signErr } = await supabase.storage.from("scans").createSignedUrl(master, 600);
        if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "file missing");
        const res = await fetch(signed.signedUrl);
        if (!res.ok) throw new Error(`download failed (${res.status})`);
        const blob = await res.blob();
        const file = new File([blob], master.split("/").pop() ?? "photo", { type: blob.type });
        if (!canDerive(file)) continue;
        const d = await makeDerivatives(file);
        const vp = `${master}_view.jpg`;
        const rv = await supabase.storage.from("scans").upload(vp, d.view.blob, { upsert: true, contentType: "image/jpeg" });
        if (rv.error) throw new Error(rv.error.message);
        patch[`${side}_view_path`] = vp;
        // Refresh the small thumbnail too when it is missing.
        const hasThumb = side === "front" ? p.front_thumb_path : p.back_thumb_path;
        if (!hasThumb) {
          const tp = `${master}_thumb.jpg`;
          const rt = await supabase.storage.from("scans").upload(tp, d.thumb.blob, { upsert: true, contentType: "image/jpeg" });
          if (!rt.error) patch[`${side}_thumb_path`] = tp;
        }
      }
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("photos").update(patch).eq("id", p.id);
        if (error) throw error;
      }
    } catch (e) {
      failed.push(`${p.caption ?? p.id}: ${(e as Error).message}`);
    }
    done++;
    onProgress?.(done, need.length);
  }
  return { done: done - failed.length, failed };
}
