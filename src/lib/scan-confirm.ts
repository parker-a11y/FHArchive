/**
 * Confirm-upload-complete workflow.
 *
 * Masters are uploaded and named first; JPEG viewing copies and thumbnails are
 * only generated once the archivist explicitly confirms the batch. The master
 * TIFF is never altered — derivatives are read-only products of it and can be
 * regenerated at any time.
 */

import { supabase } from "@/integrations/supabase/client";
import { canDerive, makeDerivatives } from "@/lib/derivatives";
import { rotateBlob } from "@/lib/rotate";
import { basenameOf, extensionOf } from "@/lib/scan-rename";
import type { DigitalFileWithDerivatives } from "@/lib/digital-files";

const BUCKET = "scans";

export type ScanStatusKey =
  | "empty"
  | "uploading"
  | "needs_naming"
  | "ready_to_confirm"
  | "generating"
  | "updated_needs_confirmation"
  | "error"
  | "complete";

export const SCAN_STATUS_LABEL: Record<ScanStatusKey, string> = {
  empty: "No Scans Yet",
  uploading: "Upload In Progress",
  needs_naming: "Needs Naming",
  ready_to_confirm: "Ready to Confirm",
  generating: "Generating Derivatives",
  updated_needs_confirmation: "Updated — Needs Confirmation",
  error: "Processing Error",
  complete: "Processing Complete",
};

export function hasJpeg(f: DigitalFileWithDerivatives) {
  return f.derivatives.some((d) => d.kind === "jpeg" && d.status === "complete");
}
export function hasThumb(f: DigitalFileWithDerivatives) {
  return f.derivatives.some((d) => d.kind === "thumbnail" && d.status === "complete");
}
export function derivativeFailed(f: DigitalFileWithDerivatives) {
  return f.derivatives.some((d) => d.status === "failed");
}

/** A master is "named" once it carries a descriptive archival label. */
export function isNamed(f: DigitalFileWithDerivatives) {
  return Boolean(f.label && f.label.trim());
}

export function unnamedFiles(files: DigitalFileWithDerivatives[]) {
  return files.filter((f) => !isNamed(f));
}

/** Masters still missing a complete JPEG or thumbnail. */
export function pendingFiles(files: DigitalFileWithDerivatives[]) {
  return files.filter((f) => !hasJpeg(f) || !hasThumb(f));
}

export function scanStatus(
  files: DigitalFileWithDerivatives[],
  opts: { uploading?: boolean; generating?: boolean } = {},
): ScanStatusKey {
  if (opts.generating) return "generating";
  if (opts.uploading) return "uploading";
  if (!files.length) return "empty";
  // Naming is optional — unnamed masters are sequentially numbered on confirm.
  const pending = pendingFiles(files);
  if (!pending.length) return files.some(derivativeFailed) ? "error" : "complete";
  if (pending.some(derivativeFailed)) return "error";
  // Some masters already processed → this is a later addition to the record.
  return files.length > pending.length ? "updated_needs_confirmation" : "ready_to_confirm";
}

async function masterAsFile(file: DigitalFileWithDerivatives): Promise<File> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.master_path, 600);
  if (error || !data?.signedUrl) throw new Error("Could not read the archival master");
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`Could not download the archival master (${res.status})`);
  const blob = await res.blob();
  const name = `${basenameOf(file.master_path)}.${extensionOf(file.master_path)}`;
  return new File([blob], name, { type: file.master_mime || blob.type || undefined });
}

/**
 * Generates (or regenerates) the JPEG + thumbnail for one master.
 * The master itself is only read, never rewritten.
 */
export async function generateDerivatives(
  archiveId: string,
  letterId: string,
  file: DigitalFileWithDerivatives,
) {
  const base = basenameOf(file.master_path);
  const source = await masterAsFile(file);
  if (!canDerive(source)) throw new Error("This file type cannot produce image derivatives");

  const base0 = await makeDerivatives(source);
  // Any pending display rotation is baked into the derivatives, never the master.
  const deg = (((file.rotation ?? 0) % 360) + 360) % 360;
  const derived = deg
    ? {
        ...base0,
        view: await rotateBlob(base0.view.blob, deg),
        thumb: await rotateBlob(base0.thumb.blob, deg),
      }
    : base0;
  const viewPath = `${archiveId}/derivatives/${base}.jpg`;
  const thumbPath = `${archiveId}/derivatives/${base}_thumb.jpg`;

  const [v, t] = await Promise.all([
    supabase.storage
      .from(BUCKET)
      .upload(viewPath, derived.view.blob, { upsert: true, contentType: "image/jpeg" }),
    supabase.storage
      .from(BUCKET)
      .upload(thumbPath, derived.thumb.blob, { upsert: true, contentType: "image/jpeg" }),
  ]);
  if (v.error || t.error) throw new Error(v.error?.message ?? t.error?.message ?? "Upload failed");

  // Replace any previous derivative rows for this master (paths are upserted).
  await supabase
    .from("file_derivatives")
    .delete()
    .eq("file_id", file.id)
    .in("kind", ["jpeg", "thumbnail"]);

  const { error } = await supabase.from("file_derivatives").insert([
    {
      letter_id: letterId,
      file_id: file.id,
      kind: "jpeg",
      status: "complete",
      storage_path: viewPath,
      mime_type: "image/jpeg",
      file_size: derived.view.blob.size,
      width: derived.view.width,
      height: derived.view.height,
    },
    {
      letter_id: letterId,
      file_id: file.id,
      kind: "thumbnail",
      status: "complete",
      storage_path: thumbPath,
      mime_type: "image/jpeg",
      file_size: derived.thumb.blob.size,
      width: derived.thumb.width,
      height: derived.thumb.height,
    },
  ] as never);
  if (error) throw error;
  if (deg) await supabase.from("digital_files").update({ rotation: 0 } as never).eq("id", file.id);
}

export async function recordDerivativeFailure(
  letterId: string,
  fileId: string,
  message: string,
) {
  await supabase
    .from("file_derivatives")
    .delete()
    .eq("file_id", fileId)
    .in("kind", ["jpeg", "thumbnail"]);
  await supabase.from("file_derivatives").insert({
    letter_id: letterId,
    file_id: fileId,
    kind: "jpeg",
    status: "failed",
    error: message,
  } as never);
}
