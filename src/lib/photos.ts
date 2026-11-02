/**
 * Photo gallery: simple photos (front, optional back, caption, notes) that are
 * not FH records. Files live in the private `scans` bucket under `photos/`.
 */
import { supabase } from "@/integrations/supabase/client";
import { canDerive, makeThumbnail } from "@/lib/derivatives";
import { legacyPhotoNotes } from "@/lib/photo-notes";

export type Photo = {
  id: string;
  front_path: string;
  front_thumb_path: string | null;
  back_path: string | null;
  back_thumb_path: string | null;
  caption: string | null;
  notes: string | null;
  legacy_archive_id: string | null;
  created_at: string;
};

const COLS = "id, front_path, front_thumb_path, back_path, back_thumb_path, caption, notes, legacy_archive_id, created_at";

export async function fetchPhotos(): Promise<Photo[]> {
  const out: Photo[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("photos")
      .select(COLS)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Photo[]));
    if (!data || data.length < 1000) return out;
  }
}

async function uploadOne(file: File): Promise<{ path: string; thumb: string | null }> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `photos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
  const { error } = await supabase.storage
    .from("scans")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(`${file.name}: ${error.message}`);
  let thumb: string | null = null;
  if (canDerive(file)) {
    try {
      const t = await makeThumbnail(file);
      const tp = `${path}_thumb.jpg`;
      const r = await supabase.storage.from("scans").upload(tp, t.blob, { upsert: true, contentType: "image/jpeg" });
      if (!r.error) thumb = tp;
    } catch {
      /* preview is optional */
    }
  }
  return { path, thumb };
}

export async function createPhoto(input: { front: File; back?: File | null; caption?: string; notes?: string }) {
  const [front, back] = await Promise.all([uploadOne(input.front), input.back ? uploadOne(input.back) : null]);
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("photos").insert({
    front_path: front.path,
    front_thumb_path: front.thumb,
    back_path: back?.path ?? null,
    back_thumb_path: back?.thumb ?? null,
    caption: input.caption?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: auth.user?.id ?? null,
  });
  if (error) {
    const paths = [front.path, front.thumb, back?.path, back?.thumb].filter(Boolean) as string[];
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

export async function deletePhoto(p: Photo) {
  const { error } = await supabase.from("photos").delete().eq("id", p.id);
  if (error) throw error;
  // Converted FH photos still share files with their retired record; leave those.
  if (p.legacy_archive_id) return;
  const paths = [p.front_path, p.front_thumb_path, p.back_path, p.back_thumb_path].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("scans").remove(paths);
}

export const viewPath = (path: string | null, thumb: string | null) =>
  thumb ?? (path && !/\.tiff?$/i.test(path) ? path : null);

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
