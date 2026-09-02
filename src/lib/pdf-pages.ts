/**
 * Browser-side PDF page rendering.
 *
 * The uploaded PDF master is never modified — pdf.js only reads it and paints
 * each page onto a canvas, which we then encode as a viewing JPEG plus a
 * thumbnail. Those page images are what the archive displays and what the AI
 * transcription/analysis reads, exactly like scanned TIFF/JPEG masters.
 */

import { jpegFromCanvas, THUMB_MAX, VIEW_MAX, type DerivedImage } from "@/lib/derivatives";

export type RenderedPdfPage = {
  page: number;
  view: DerivedImage;
  thumb: DerivedImage;
};

/** Hard cap so a huge PDF cannot lock up the browser tab. */
export const MAX_PDF_PAGES = 60;

export function isPdfFile(file: { name?: string; type?: string }) {
  return /pdf/i.test(file.type ?? "") || /\.pdf$/i.test(file.name ?? "");
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
  return pdfjs;
}

/**
 * Renders every page of a PDF to a viewing JPEG + thumbnail.
 * `onProgress` reports (pagesDone, pageCount) so callers can show a counter.
 */
export async function renderPdfPages(
  file: File | Blob,
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedPdfPage[]> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  const out: RenderedPdfPage[] = [];

  try {
    for (let n = 1; n <= total; n += 1) {
      const page = await doc.getPage(n);
      // Render at roughly 200 dpi so handwriting stays legible for the AI.
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3, Math.max(1, VIEW_MAX / Math.max(base.width, base.height)));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const view = await jpegFromCanvas(canvas, VIEW_MAX, 0.88);
      const thumb = await jpegFromCanvas(canvas, THUMB_MAX, 0.8);
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      out.push({ page: n, view, thumb });
      onProgress?.(n, total);
    }
  } finally {
    await doc.loadingTask?.destroy();
  }

  if (!out.length) throw new Error("This PDF has no readable pages");
  return out;
}
