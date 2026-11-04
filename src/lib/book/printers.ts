/**
 * Printer profiles. Values follow each company's published file guidelines for
 * perfect-bound paperbacks (checked Nov 2026). Printers revise their specs, so
 * the app still tells the user to run the printer's own uploader check.
 */

export type PrinterId = "generic" | "lulu" | "blurb" | "bookbaby";
export type Trim = { id: string; label: string; w: number; h: number };

export const TRIMS: Trim[] = [
  { id: "8.5x11", label: "8.5 × 11 in (US Letter)", w: 8.5, h: 11 },
  { id: "6x9", label: "6 × 9 in (Trade)", w: 6, h: 9 },
];

export type PrinterProfile = {
  id: PrinterId;
  name: string;
  /** Extra paper beyond the trim on each outside edge, in inches. */
  bleedIn: number;
  /** Text and important content must stay this far inside the trim, in inches. */
  safeIn: number;
  minPages: number;
  maxPages: number;
  /** Page count must be a multiple of this (blank pages are added at the end). */
  pageMultiple: number;
  trims: string[];
  /** Extra inside margin by page count, in inches. */
  gutter: Array<{ upTo: number; in: number }>;
  /** Spine width in inches for a page count (standard white paper). */
  spineIn: (pages: number) => number;
  /** Smallest spine that may carry printed text. */
  spineTextMinIn: number;
  note: string;
};

const tiers = (t: Array<[number, number]>) => t.map(([upTo, v]) => ({ upTo, in: v }));

export const PRINTERS: Record<PrinterId, PrinterProfile> = {
  generic: {
    id: "generic", name: "Home / office print (no printer profile)", bleedIn: 0, safeIn: 0, minPages: 1, maxPages: 100000, pageMultiple: 1,
    trims: ["8.5x11", "6x9"], gutter: [], spineIn: (p) => p * 0.0025, spineTextMinIn: 1000,
    note: "For home printing and sharing. Not set up for a print company, so it is never labelled print-ready.",
  },
  lulu: {
    id: "lulu", name: "Lulu — paperback, perfect bound", bleedIn: 0.125, safeIn: 0.5, minPages: 32, maxPages: 800, pageMultiple: 2,
    trims: ["8.5x11", "6x9"],
    gutter: tiers([[60, 0], [150, 0.125], [400, 0.5], [600, 0.625], [100000, 0.75]]),
    spineIn: (p) => p / 444 + 0.06, spineTextMinIn: 0.25,
    note: "Lulu: 0.125 in bleed, 0.5 in safety margin, 32–800 pages, extra gutter for thicker books.",
  },
  blurb: {
    id: "blurb", name: "Blurb — trade / magazine softcover", bleedIn: 0.125, safeIn: 0.25, minPages: 24, maxPages: 480, pageMultiple: 2,
    trims: ["8.5x11", "6x9"],
    gutter: tiers([[150, 0.125], [300, 0.25], [100000, 0.375]]),
    spineIn: (p) => p * 0.0025 + 0.06, spineTextMinIn: 0.25,
    note: "Blurb: 0.125 in bleed, 0.25 in safe area, 24–480 pages, even page count.",
  },
  bookbaby: {
    id: "bookbaby", name: "BookBaby — perfect-bound paperback", bleedIn: 0.125, safeIn: 0.25, minPages: 24, maxPages: 800, pageMultiple: 2,
    trims: ["8.5x11", "6x9"],
    gutter: tiers([[150, 0.125], [400, 0.25], [100000, 0.375]]),
    spineIn: (p) => p * 0.0025, spineTextMinIn: 0.25,
    note: "BookBaby: 0.125 in bleed, 0.25 in safe zone, 24+ pages, even page count.",
  },
};

export const PRINTER_LIST = Object.values(PRINTERS);
export const printerFor = (id: string | undefined | null): PrinterProfile => PRINTERS[(id ?? "generic") as PrinterId] ?? PRINTERS.generic;

export function gutterIn(profile: PrinterProfile, pages: number) {
  return profile.gutter.find((g) => pages <= g.upTo)?.in ?? 0;
}

/** Full cover spread size in points: back + spine + front, plus bleed all round. */
export function coverSize(profile: PrinterProfile, trimW: number, trimH: number, pages: number) {
  const spine = profile.spineIn(pages);
  const b = profile.bleedIn;
  return { spineIn: spine, widthPt: (trimW * 2 + spine + b * 2) * 72, heightPt: (trimH + b * 2) * 72, bleedPt: b * 72, spinePt: spine * 72 };
}
