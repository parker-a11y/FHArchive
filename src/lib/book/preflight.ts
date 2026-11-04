/**
 * Preflight: checks a laid-out book against the chosen printer profile before
 * export. Used by the editor panel and by the export worker, so both report
 * the same result. "Print-ready" is only ever true for a real printer profile
 * with no blocking problems.
 */
import type { BookFonts } from "./fonts";
import type { BookPlan, BookWarning } from "./types";
import { PRINT_DPI_MIN } from "./types";
import { printerFor } from "./printers";

export type PreflightItem = { level: "error" | "warning" | "info"; message: string; page?: number; archiveId?: string | null };
export type PreflightResult = { printer: string; printerName: string; printReady: boolean; items: PreflightItem[] };

export function runPreflight(plan: BookPlan, bookWarnings: BookWarning[], printerId: string | undefined, fonts: BookFonts): PreflightResult {
  const profile = printerFor(printerId);
  const real = profile.id !== "generic";
  const items: PreflightItem[] = [];
  const W = plan.widthPt;
  const H = plan.heightPt;
  const safe = profile.safeIn * 72;
  const bleed = plan.bleedPt ?? 0;

  for (const w of bookWarnings) if (w.level === "error") items.push({ level: "error", message: w.message, archiveId: w.archiveId });

  const count = plan.pages.length;
  if (real && count < profile.minPages) items.push({ level: "error", message: `${count} pages is below ${profile.name.split(" —")[0]}'s minimum of ${profile.minPages}. Add pages or records.` });
  if (real && count > profile.maxPages) items.push({ level: "error", message: `${count} pages is above ${profile.name.split(" —")[0]}'s maximum of ${profile.maxPages}. Split the book into volumes.` });
  if (plan.paddedPages) items.push({ level: "info", message: `${plan.paddedPages} blank page${plan.paddedPages === 1 ? "" : "s"} added at the end to make an even page count, as the printer requires.` });

  let outside = 0;
  let edgeNoBleed = 0;
  let lowRes = 0;
  const outsidePages = new Set<number>();
  for (const p of plan.pages) {
    for (const el of p.elements) {
      if (el.t === "text" && real) {
        const w = fonts.width(el.font, el.text, el.size);
        const x2 = el.rotate ? el.x + el.size : el.x + w;
        const y1 = el.rotate ? el.y : el.y - el.size * 0.75;
        const y2 = el.rotate ? el.y + w : el.y + el.size * 0.25;
        if (el.x < safe - 0.5 || x2 > W - safe + 0.5 || y1 < safe - 0.5 || y2 > H - safe + 0.5) {
          outside++;
          outsidePages.add(p.index);
        }
      }
      if (el.t === "image") {
        if (el.dpi && el.dpi < PRINT_DPI_MIN) {
          lowRes++;
          items.push({ level: real ? "error" : "warning", message: `${el.image.label || "Image"} prints at about ${el.dpi} DPI (below ${PRINT_DPI_MIN}).`, page: p.index, archiveId: p.archiveId });
        }
        const r = el.clip ?? el;
        const touches = r.x <= 0.5 || r.y <= 0.5 || r.x + r.w >= W - 0.5 || r.y + r.h >= H - 0.5;
        const bleeds = r.x <= -bleed + 0.5 || r.y <= -bleed + 0.5;
        if (real && touches && bleed > 0 && !bleeds) edgeNoBleed++;
      }
    }
  }
  if (outside) items.push({ level: "error", message: `Text sits outside the printer's ${profile.safeIn} in safe area on ${outsidePages.size} page${outsidePages.size === 1 ? "" : "s"} (first: page ${Math.min(...outsidePages)}). Move it inward on the custom page.`, page: Math.min(...outsidePages) });
  if (edgeNoBleed) items.push({ level: "error", message: `${edgeNoBleed} image${edgeNoBleed === 1 ? " runs" : "s run"} to the page edge without extending into the bleed. Use the Full-bleed setting for edge-to-edge photos.` });
  if (fonts.missing.size) items.push({ level: "warning", message: `Some characters are not in the book typeface: ${[...fonts.missing].join(" ")}` });
  if (!lowRes && plan.pages.some((p) => p.elements.some((e) => e.t === "image"))) items.push({ level: "info", message: "Every image prints at 200 DPI or better." });
  items.push({ level: "info", message: "Fonts are embedded in the PDF." });
  if (!real) items.push({ level: "info", message: "No printer profile chosen, so this export is a proof for home printing, not a print-ready file." });

  const printReady = real && !items.some((i) => i.level === "error");
  return { printer: profile.id, printerName: profile.name, printReady, items };
}
