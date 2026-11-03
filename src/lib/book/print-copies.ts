/**
 * Prepares full-resolution print copies for a book's scans, in the browser.
 * The archive's TIFF masters are read, never changed; each print copy is a
 * new derivative (kind "print") stored next to the existing viewing copies.
 * This runs in the browser because the server cannot decode large TIFFs.
 */
import { supabase } from "@/integrations/supabase/client";
import { makePrintCopy } from "@/lib/derivatives";
import type { BookImage, BookRecordSource } from "./types";

export type PrintCopyTarget = { record: BookRecordSource; image: BookImage };

export function printCopyTargets(records: BookRecordSource[]): PrintCopyTarget[] {
  return records.flatMap((r) => [...r.scans, ...r.envelopes].filter((i) => i.source !== "print").map((image) => ({ record: r, image })));
}

export async function preparePrintCopy(t: PrintCopyTarget) {
  const { data: file, error } = await supabase
    .from("digital_files")
    .select("id, letter_id, master_path, master_mime, original_filename")
    .eq("id", t.image.fileId)
    .single();
  if (error || !file) throw new Error(error?.message ?? "Scan not found");
  if (/pdf/i.test(file.master_mime ?? "")) throw new Error("PDF masters can't be converted; the viewing copy is used.");
  const { data: blob, error: dErr } = await supabase.storage.from("scans").download(file.master_path);
  if (dErr || !blob) throw new Error(dErr?.message ?? "Master could not be downloaded");
  const master = new File([blob], file.original_filename ?? "master.tif", { type: file.master_mime ?? blob.type });
  const print = await makePrintCopy(master, t.image.previewUrl ?? null);
  const path = `${t.record.archiveId}/print/${file.id}.jpg`;
  const { error: uErr } = await supabase.storage.from("scans").upload(path, print.blob, { contentType: "image/jpeg", upsert: true });
  if (uErr) throw new Error(uErr.message);
  const row = {
    letter_id: file.letter_id,
    file_id: file.id,
    kind: "print",
    status: "complete",
    storage_path: path,
    mime_type: "image/jpeg",
    file_size: print.blob.size,
    width: print.width,
    height: print.height,
  };
  const { data: existing } = await supabase.from("file_derivatives").select("id").eq("file_id", file.id).eq("kind", "print").maybeSingle();
  const { error: iErr } = existing
    ? await supabase.from("file_derivatives").update(row as never).eq("id", existing.id)
    : await supabase.from("file_derivatives").insert(row as never);
  if (iErr) throw new Error(iErr.message);
  return print;
}
