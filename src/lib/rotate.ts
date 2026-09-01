/**
 * Browser-side image rotation.
 *
 * Rotation is baked into the *derivative* images (viewing JPG + thumbnail) and
 * into uploaded photographs, so downloads, emails and shares all show the
 * correct orientation. Archival masters (TIFFs) are never rewritten.
 */

import { supabase } from "@/integrations/supabase/client";

export type RotatedImage = { blob: Blob; width: number; height: number };

function mimeFor(path: string) {
  return /\.png$/i.test(path) ? "image/png" : "image/jpeg";
}

/** Rotates an image blob clockwise by 90 / 180 / 270 degrees. */
export async function rotateBlob(
  blob: Blob,
  degrees: number,
  type = "image/jpeg",
  quality = 0.92,
): Promise<RotatedImage> {
  const deg = ((degrees % 360) + 360) % 360;
  const bitmap = await createImageBitmap(blob);
  const swap = deg === 90 || deg === 270;
  const width = swap ? bitmap.height : bitmap.width;
  const height = swap ? bitmap.width : bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.translate(width / 2, height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close?.();
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
  canvas.width = 0;
  canvas.height = 0;
  if (!out) throw new Error("Browser could not encode the rotated image");
  return { blob: out, width, height };
}

/**
 * Downloads a stored image, rotates it and writes it back to the same path.
 * Returns the new dimensions and size so database rows can be kept in sync.
 */
export async function rotateStoredImage(
  bucket: string,
  path: string,
  degrees: number,
): Promise<{ width: number; height: number; size: number }> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not read the image");
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`Could not download the image (${res.status})`);
  const type = mimeFor(path);
  const rotated = await rotateBlob(await res.blob(), degrees, type);
  const up = await supabase.storage
    .from(bucket)
    .upload(path, rotated.blob, { upsert: true, contentType: type });
  if (up.error) throw new Error(up.error.message);
  return { width: rotated.width, height: rotated.height, size: rotated.blob.size };
}
