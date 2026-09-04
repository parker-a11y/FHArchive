/**
 * Confirm-upload-complete workflow.
 *
 * Masters are uploaded and named first; JPEG viewing copies and thumbnails are
 * only generated once the archivist explicitly confirms the batch. The master
 * TIFF is never altered — derivatives are read-only products of it and can be
 * regenerated at any time.
 */

import { supabase } from "@/integrations/supabase/client";
import { canDerive, makeDerivatives, makeThumbnail } from "@/lib/derivatives";
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

export function isPdf(f: DigitalFileWithDerivatives) {
  return /pdf/i.test(f.master_mime ?? "") || /\.pdf$/i.test(f.master_path ?? "");
}

/**
 * Which masters produce viewing images. PDFs qualify: the master file is stored
 * byte-for-byte and each page is rendered to a JPEG so it can be viewed,
 * transcribed and analysed like any scan. Anything else (audio, zip, …) does not.
 */
export function needsDerivatives(f: DigitalFileWithDerivatives) {
  const path = f.master_path ?? "";
  const mime = f.master_mime ?? "";
  if (isPdf(f)) return true;
  return (
    /\.tiff?$/i.test(path) ||
    /^image\/(tiff|jpeg|png|webp|gif|bmp)$/i.test(mime) ||
    /\.(jpe?g|png|webp|gif|bmp)$/i.test(path)
  );
}

export function hasJpeg(f: DigitalFileWithDerivatives) {
  return f.derivatives.some((d) => d.kind === "jpeg" && d.status === "complete");
}
export function hasThumb(f: DigitalFileWithDerivatives) {
  return f.derivatives.some((d) => d.kind === "thumbnail" && d.status === "complete");
}
export function derivativeFailed(f: DigitalFileWithDerivatives) {
  if (!needsDerivatives(f)) return false; // PDFs never needed one
  return f.derivatives.some((d) => d.status === "failed");
}

/** A master is "named" once it carries a descriptive archival label. */
export function isNamed(f: DigitalFileWithDerivatives) {
  return Boolean(f.label && f.label.trim());
}

export function unnamedFiles(files: DigitalFileWithDerivatives[]) {
  return files.filter((f) => !isNamed(f));
}

/** Masters still missing a complete JPEG or thumbnail (PDFs are never pending). */
export function pendingFiles(files: DigitalFileWithDerivatives[]) {
  return files.filter((f) => needsDerivatives(f) && (!hasJpeg(f) || !hasThumb(f)));
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
  const derivable = files.filter(needsDerivatives);
  return derivable.length > pending.length ? "updated_needs_confirmation" : "ready_to_confirm";
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
 * Renders every page of a PDF master to a viewing JPEG + thumbnail so the PDF
 * is web viewable and can be transcribed/analysed page by page. The PDF master
 * itself is only read, never rewritten.
 */
export async function generatePdfPageDerivatives(
  archiveId: string,
  letterId: string,
  file: DigitalFileWithDerivatives,
  onProgress?: (done: number, total: number) => void,
) {
  const { renderPdfPages } = await import("@/lib/pdf-pages");
  const base = basenameOf(file.master_path);
  const source = await masterAsFile(file);
  const pages = await renderPdfPages(source, onProgress);

  const rows: Record<string, unknown>[] = [];
  for (const p of pages) {
    const suffix = String(p.page).padStart(3, "0");
    const viewPath = `${archiveId}/derivatives/${base}_p${suffix}.jpg`;
    const thumbPath = `${archiveId}/derivatives/${base}_p${suffix}_thumb.jpg`;
    const [v, t] = await Promise.all([
      supabase.storage
        .from(BUCKET)
        .upload(viewPath, p.view.blob, { upsert: true, contentType: "image/jpeg" }),
      supabase.storage
        .from(BUCKET)
        .upload(thumbPath, p.thumb.blob, { upsert: true, contentType: "image/jpeg" }),
    ]);
    if (v.error || t.error) {
      throw new Error(v.error?.message ?? t.error?.message ?? "Page upload failed");
    }
    rows.push(
      {
        letter_id: letterId,
        file_id: file.id,
        kind: "jpeg",
        status: "complete",
        storage_path: viewPath,
        mime_type: "image/jpeg",
        file_size: p.view.blob.size,
        width: p.view.width,
        height: p.view.height,
      },
      {
        letter_id: letterId,
        file_id: file.id,
        kind: "thumbnail",
        status: "complete",
        storage_path: thumbPath,
        mime_type: "image/jpeg",
        file_size: p.thumb.blob.size,
        width: p.thumb.width,
        height: p.thumb.height,
      },
    );
  }

  await supabase
    .from("file_derivatives")
    .delete()
    .eq("file_id", file.id)
    .in("kind", ["jpeg", "thumbnail"]);
  const { error } = await supabase.from("file_derivatives").insert(rows as never);
  if (error) throw error;
  return pages.length;
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
  if (isPdf(file)) {
    await generatePdfPageDerivatives(archiveId, letterId, file);
    return;
  }
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

  // Drop any earlier preview thumbnail stored under the pre-rename filename.
  const stale = file.derivatives
    .map((d) => d.storage_path)
    .filter((p): p is string => !!p && p !== viewPath && p !== thumbPath);
  if (stale.length) await supabase.storage.from(BUCKET).remove(stale);

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

/**
 * Makes a small preview thumbnail straight from the file being uploaded, so a
 * master is recognisable in the identification grid before the batch is
 * confirmed. The full derivative pass on confirm replaces it (and renames it to
 * match the final archival filename).
 */
export async function generatePreviewThumbnail(
  archiveId: string,
  letterId: string,
  fileId: string,
  masterPath: string,
  source: File,
) {
  if (!canDerive(source)) return;
  const thumb = await makeThumbnail(source);
  const thumbPath = `${archiveId}/derivatives/${basenameOf(masterPath)}_thumb.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, thumb.blob, { upsert: true, contentType: "image/jpeg" });
  if (upErr) throw new Error(upErr.message);
  await supabase
    .from("file_derivatives")
    .delete()
    .eq("file_id", fileId)
    .eq("kind", "thumbnail");
  const { error } = await supabase.from("file_derivatives").insert({
    letter_id: letterId,
    file_id: fileId,
    kind: "thumbnail",
    status: "complete",
    storage_path: thumbPath,
    mime_type: "image/jpeg",
    file_size: thumb.blob.size,
    width: thumb.width,
    height: thumb.height,
  } as never);
  if (error) throw error;
}
