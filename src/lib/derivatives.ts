/**
 * Browser-side derivative generation.
 *
 * The archival master is uploaded byte-for-byte and never touched. These
 * helpers only ever *read* the file to produce new JPEG viewing / thumbnail
 * images. Runs in the browser because the Worker backend has no native image
 * toolchain (sharp/ImageMagick are unavailable there).
 */

export const VIEW_MAX = 2400;
export const THUMB_MAX = 480;

export type DerivedImage = {
  blob: Blob;
  width: number;
  height: number;
};

export type DerivedSet = {
  view: DerivedImage;
  thumb: DerivedImage;
  sourceWidth: number;
  sourceHeight: number;
};

type Source = { canvas: HTMLCanvasElement; width: number; height: number };

const MAX_TIFF_PIXELS = 120_000_000; // ~480 MB raw RGBA; most browsers can handle this

async function decodeTiff(file: File): Promise<Source> {
  const mod = await import("utif2");
  const UTIF = ((mod as unknown as { default?: unknown }).default ?? mod) as {
    decode: (b: ArrayBuffer) => Record<string, unknown>[];
    decodeImage: (b: ArrayBuffer, ifd: unknown, ifds: unknown) => void;
    toRGBA8: (ifd: unknown) => Uint8Array;
  };
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  if (!ifds.length) throw new Error("No image found inside the TIFF");
  const page = ifds[0];

  // UTIF only populates ifd.width/height during decodeImage(); before that the
  // dimensions live in the raw TIFF tags t256 (ImageWidth) / t257 (ImageLength).
  const tagValue = (ifd: Record<string, unknown>, tag: string): number => {
    const raw = ifd[tag];
    const v = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  let width = tagValue(page, "t256") || Number(page["width"]) || 0;
  let height = tagValue(page, "t257") || Number(page["height"]) || 0;

  if (width && height && width * height > MAX_TIFF_PIXELS) {
    throw new Error(
      `TIFF is too large to decode in the browser (${width.toLocaleString()} × ${height.toLocaleString()} pixels). ` +
        `Please downsample the master or contact support for server-side processing.`,
    );
  }

  try {
    UTIF.decodeImage(buf, page, ifds);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`TIFF could not be decoded (${msg}). The file may use an unsupported compression.`);
  }

  width = Number(page["width"]) || width;
  height = Number(page["height"]) || height;
  if (!width || !height) throw new Error("TIFF has no readable dimensions");

  const rgba = UTIF.toRGBA8(page);
  if (!rgba || rgba.length < width * height * 4) {
    throw new Error("TIFF pixel data could not be read (unsupported compression or corrupt file)");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  const pixels = new Uint8ClampedArray(width * height * 4);
  pixels.set(rgba.subarray(0, pixels.length));
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  return { canvas, width, height };
}


async function decodeBrowserImage(file: File): Promise<Source> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return { canvas, width: bitmap.width, height: bitmap.height };
}

function scaleTo(source: Source, max: number, quality: number): Promise<DerivedImage> {
  const ratio = Math.min(1, max / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * ratio));
  const height = Math.max(1, Math.round(source.height * ratio));
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas is unavailable in this browser"));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.canvas, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) =>
        blob
          ? resolve({ blob, width, height })
          : reject(new Error("Browser could not encode the JPEG derivative")),
      "image/jpeg",
      quality,
    );
  });
}

/** Scales any already-rendered canvas down to a JPEG (used by the PDF renderer). */
export function jpegFromCanvas(
  canvas: HTMLCanvasElement,
  max: number,
  quality: number,
): Promise<DerivedImage> {
  return scaleTo({ canvas, width: canvas.width, height: canvas.height }, max, quality);
}

export function canDerive(file: File) {
  return (
    /\.tiff?$/i.test(file.name) ||
    /^image\/(tiff|jpeg|png|webp|gif|bmp)$/i.test(file.type) ||
    /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)
  );
}

/** Reads the master and returns a JPEG viewing copy plus a gallery thumbnail. */
export async function makeDerivatives(file: File): Promise<DerivedSet> {
  const source = /\.tiff?$/i.test(file.name) || /tiff/i.test(file.type)
    ? await decodeTiff(file)
    : await decodeBrowserImage(file);
  const view = await scaleTo(source, VIEW_MAX, 0.88);
  const thumb = await scaleTo(source, THUMB_MAX, 0.8);
  source.canvas.width = 0;
  source.canvas.height = 0;
  return { view, thumb, sourceWidth: source.width, sourceHeight: source.height };
}
