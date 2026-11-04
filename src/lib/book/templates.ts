/**
 * Custom-page templates. Each returns a starting layout (boxes in points on an
 * 8.5 × 11 in page) that the visual editor can then change freely.
 */
import type { CustomPageDoc, PageBox, PageImageBox, PageTextBox, TextStyle } from "./types";

export const PAGE_W = 612;
export const PAGE_H = 792;
/** Shared safe area used by templates and snapping (average of inside/outside margins). */
export const SAFE = { x: 65, y: 66, w: 482, h: 652 };

let seq = 0;
export const boxId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const textBox = (x: number, y: number, w: number, h: number, style: TextStyle, text = "", align: PageTextBox["align"] = "left"): PageTextBox => ({
  id: boxId(), kind: "text", x, y, w, h, style, text, align,
});
export const imageBox = (x: number, y: number, w: number, h: number, mode: PageImageBox["mode"] = "fit", caption?: string): PageImageBox => ({
  id: boxId(), kind: "image", x, y, w, h, ref: null, mode, caption,
});

const { x, y, w, h } = SAFE;
const half = (w - 18) / 2;

export const TEMPLATES: Array<{ id: string; name: string; build: () => Omit<CustomPageDoc, "template"> }> = [
  { id: "blank", name: "Blank page", build: () => ({ folio: false, boxes: [] }) },
  { id: "divider", name: "Section divider", build: () => ({ folio: false, boxes: [textBox(x, h * 0.42, w, 60, "heading", "Part One", "center"), textBox(x + 60, h * 0.42 + 64, w - 120, 60, "caption", "", "center")] }) },
  { id: "text", name: "Full-page text", build: () => ({ folio: true, boxes: [textBox(x, y, w, h, "body", "")] }) },
  { id: "heading-text", name: "Text with heading", build: () => ({ folio: true, boxes: [textBox(x, y, w, 40, "heading", "Heading", "center"), textBox(x, y + 56, w, h - 56, "body", "")] }) },
  { id: "quote", name: "Quotation page", build: () => ({ folio: false, boxes: [textBox(x + 40, h * 0.36, w - 80, 160, "quote", "“”", "center"), textBox(x + 40, h * 0.36 + 170, w - 80, 30, "caption", "— ", "right")] }) },
  { id: "photo-fit", name: "Single photo, fit", build: () => ({ folio: true, boxes: [imageBox(x, y, w, h, "fit")] }) },
  { id: "photo-bleed", name: "Single photo, full-bleed", build: () => ({ folio: false, boxes: [imageBox(0, 0, PAGE_W, PAGE_H, "bleed")] }) },
  { id: "photo-caption", name: "Photo + caption", build: () => ({ folio: true, boxes: [imageBox(x, y, w, h - 70, "fit"), textBox(x, y + h - 56, w, 56, "caption", "", "center")] }) },
  { id: "photo-top-text", name: "Photo top, text below", build: () => ({ folio: true, boxes: [imageBox(x, y, w, h * 0.5, "fill"), textBox(x, y + h * 0.5 + 18, w, h * 0.5 - 18, "body", "")] }) },
  { id: "text-photo", name: "Text left, photo right", build: () => ({ folio: true, boxes: [textBox(x, y, half, h, "body", ""), imageBox(x + half + 18, y, half, h, "fit")] }) },
  { id: "two-photos", name: "Two photos", build: () => ({ folio: true, boxes: [imageBox(x, y, w, (h - 18) / 2, "fit"), imageBox(x, y + (h - 18) / 2 + 18, w, (h - 18) / 2, "fit")] }) },
  { id: "four-grid", name: "Four-photo grid", build: () => ({ folio: true, boxes: [0, 1, 2, 3].map((i) => imageBox(x + (i % 2) * (half + 18), y + Math.floor(i / 2) * ((h - 18) / 2 + 18), half, (h - 18) / 2, "fill")) }) },
  { id: "collage", name: "Photo collage (3)", build: () => ({ folio: true, boxes: [imageBox(x, y, w, h * 0.55, "fill"), imageBox(x, y + h * 0.55 + 14, half, h * 0.45 - 14, "fill"), imageBox(x + half + 18, y + h * 0.55 + 14, half, h * 0.45 - 14, "fill")] }) },
  { id: "document", name: "Map / document page", build: () => ({ folio: true, boxes: [textBox(x, y, w, 30, "heading", "", "center"), imageBox(x, y + 44, w, h - 104, "fit"), textBox(x, y + h - 50, w, 50, "caption", "", "center")] }) },
  { id: "timeline", name: "Timeline / dates list", build: () => ({ folio: true, boxes: [textBox(x, y, w, 40, "heading", "Timeline", "center"), textBox(x, y + 56, w, h - 56, "body", "1944 — \n1945 — \n1946 — ")] }) },
  { id: "dedication", name: "Dedication / epigraph", build: () => ({ folio: false, boxes: [textBox(x + 70, h * 0.3, w - 140, 140, "quote", "For ", "center")] }) },
  { id: "essay", name: "Research essay (long-form)", build: () => ({ folio: true, boxes: [], flow: { heading: "", text: "" } }) },
];

export function makeTemplate(id: string): CustomPageDoc {
  const t = TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
  return { template: t.id, name: t.name, ...t.build() };
}

export const templateName = (id: string) => TEMPLATES.find((t) => t.id === id)?.name ?? "Custom page";

/** Fill / full-bleed crop: draw size and offset so the image covers the box, centred. */
export function coverRect(imgW: number, imgH: number, box: { x: number; y: number; w: number; h: number }) {
  const ratio = imgW > 0 && imgH > 0 ? imgW / imgH : box.w / box.h;
  let dw = box.w;
  let dh = dw / ratio;
  if (dh < box.h) {
    dh = box.h;
    dw = dh * ratio;
  }
  return { x: box.x + (box.w - dw) / 2, y: box.y + (box.h - dh) / 2, w: dw, h: dh };
}

/** Fit: the whole image inside the box, centred, never cropped. */
export function containRect(imgW: number, imgH: number, box: { x: number; y: number; w: number; h: number }) {
  const ratio = imgW > 0 && imgH > 0 ? imgW / imgH : box.w / box.h;
  let dw = box.w;
  let dh = dw / ratio;
  if (dh > box.h) {
    dh = box.h;
    dw = dh * ratio;
  }
  return { x: box.x + (box.w - dw) / 2, y: box.y + (box.h - dh) / 2, w: dw, h: dh };
}

/** Snap a moving/resizing box to margins, centre lines and other boxes. Returns snapped box and guide lines. */
export function snapBox(
  b: { x: number; y: number; w: number; h: number },
  others: Array<{ x: number; y: number; w: number; h: number }>,
  mode: "move" | "resize",
  threshold = 6,
) {
  const xs = [0, SAFE.x, SAFE.x + SAFE.w, PAGE_W / 2, PAGE_W];
  const ys = [0, SAFE.y, SAFE.y + SAFE.h, PAGE_H / 2, PAGE_H];
  for (const o of others) {
    xs.push(o.x, o.x + o.w, o.x + o.w / 2);
    ys.push(o.y, o.y + o.h, o.y + o.h / 2);
  }
  const out = { ...b };
  const guides: Array<{ axis: "x" | "y"; at: number }> = [];
  const best = (cands: number[], targets: number[]) => {
    let hit: { d: number; delta: number; at: number } | null = null;
    for (const c of cands)
      for (const t of targets) {
        const d = Math.abs(c - t);
        if (d <= threshold && (!hit || d < hit.d)) hit = { d, delta: t - c, at: t };
      }
    return hit;
  };
  if (mode === "move") {
    const hx = best([b.x, b.x + b.w / 2, b.x + b.w], xs);
    if (hx) { out.x += hx.delta; guides.push({ axis: "x", at: hx.at }); }
    const hy = best([b.y, b.y + b.h / 2, b.y + b.h], ys);
    if (hy) { out.y += hy.delta; guides.push({ axis: "y", at: hy.at }); }
  } else {
    const hx = best([b.x + b.w], xs);
    if (hx) { out.w += hx.delta; guides.push({ axis: "x", at: hx.at }); }
    const hy = best([b.y + b.h], ys);
    if (hy) { out.h += hy.delta; guides.push({ axis: "y", at: hy.at }); }
  }
  out.w = Math.max(18, out.w);
  out.h = Math.max(14, out.h);
  return { box: out, guides };
}

export function sortedBoxes(boxes: PageBox[]) {
  return [...boxes].map((b, i) => ({ b, i })).sort((a, c) => (a.b.z ?? 0) - (c.b.z ?? 0) || a.i - c.i).map((x) => x.b);
}
