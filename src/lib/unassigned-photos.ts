/**
 * Unassigned photo bucket: photos dropped in bulk are stored in the private
 * `scans` bucket under `_unassigned/` and listed in `unassigned_photos` until
 * an archivist turns them into a record.
 */
import { supabase } from "@/integrations/supabase/client";

export const UNASSIGNED_PREFIX = "_unassigned";

export type UnassignedPhoto = {
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export function unassignedPath(fileName: string, now = Date.now(), rand = Math.random()) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  return `${UNASSIGNED_PREFIX}/${now}_${rand.toString(36).slice(2, 8)}_${safe}`;
}

export async function fetchUnassignedPhotos(): Promise<UnassignedPhoto[]> {
  const out: UnassignedPhoto[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("unassigned_photos")
      .select("id, storage_path, original_filename, mime_type, size_bytes, created_at")
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as UnassignedPhoto[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function uploadUnassignedPhoto(file: File) {
  const path = unassignedPath(file.name);
  const { error } = await supabase.storage
    .from("scans")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(`${file.name}: ${error.message}`);
  const { data: auth } = await supabase.auth.getUser();
  const { error: insErr } = await supabase.from("unassigned_photos").insert({
    storage_path: path,
    original_filename: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: auth.user?.id ?? null,
  });
  if (insErr) {
    await supabase.storage.from("scans").remove([path]);
    throw new Error(`${file.name}: ${insErr.message}`);
  }
}

/** Download a staged photo as a File so it can go through normal intake. */
export async function unassignedAsFile(p: UnassignedPhoto): Promise<File> {
  const { data, error } = await supabase.storage.from("scans").download(p.storage_path);
  if (error || !data) throw new Error(`${p.original_filename}: ${error?.message ?? "download failed"}`);
  return new File([data], p.original_filename, { type: p.mime_type || data.type });
}

export async function removeUnassignedPhotos(photos: UnassignedPhoto[]) {
  if (!photos.length) return;
  await supabase.storage.from("scans").remove(photos.map((p) => p.storage_path));
  const { error } = await supabase
    .from("unassigned_photos")
    .delete()
    .in("id", photos.map((p) => p.id));
  if (error) throw error;
}
