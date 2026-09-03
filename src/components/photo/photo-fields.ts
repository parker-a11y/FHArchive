/**
 * Shared helpers for the photograph-specific intake and record views.
 *
 * Photographs are cataloged very differently from documents: the image itself
 * carries the information, so only a handful of fields matter on intake.
 */

import { supabase } from "@/integrations/supabase/client";
import { generateDerivatives } from "@/lib/scan-confirm";
import { fetchDigitalFiles } from "@/lib/digital-files";

export const PHOTO_MEDIUMS = [
  { value: "", label: "—" },
  { value: "bw", label: "Black & white" },
  { value: "color", label: "Color" },
  { value: "sepia", label: "Sepia / toned" },
] as const;

export function isPhotographType(recordType: string | null | undefined) {
  return (recordType ?? "") === "photograph";
}

/** Find an existing place by name, or create it. Returns the place id. */
export async function findOrCreatePlace(name: string): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  const { data: found } = await supabase
    .from("places")
    .select("id")
    .ilike("canonical_name", clean)
    .maybeSingle();
  if (found?.id) return found.id as string;
  const { data, error } = await supabase
    .from("places")
    .insert({ canonical_name: clean } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Upload a photograph at intake: the file is stored byte-for-byte as the
 * archival master, then the standard JPEG + thumbnail derivatives are made.
 */
export async function uploadPhotoAtIntake(
  archiveId: string,
  letterId: string,
  file: File,
) {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const masterPath = `${archiveId}/masters/${Date.now()}_${safe}`;
  const { error: upErr } = await supabase.storage
    .from("scans")
    .upload(masterPath, file, { upsert: false, contentType: file.type || undefined });
  if (upErr) throw new Error(`Master not stored — ${upErr.message}`);

  const { data: inserted, error: insErr } = await supabase
    .from("digital_files")
    .insert({
      letter_id: letterId,
      seq: 1,
      sort_order: 1,
      original_filename: file.name,
      master_path: masterPath,
      master_mime: file.type || null,
      master_size: file.size,
      filename_matches: true,
    } as never)
    .select("id")
    .single();
  if (insErr || !inserted) throw new Error(insErr?.message ?? "Photo could not be recorded");

  const files = await fetchDigitalFiles(letterId);
  const target = files.find((f) => f.id === (inserted.id as string));
  if (target) await generateDerivatives(archiveId, letterId, target);

  await supabase
    .from("letters")
    .update({
      digitization_status: "complete",
      digitization_completed_at: new Date().toISOString(),
    } as never)
    .eq("id", letterId);
}
