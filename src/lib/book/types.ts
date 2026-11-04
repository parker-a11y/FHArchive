/**
 * Shared Book Builder types. The same page plan drives the on-screen preview
 * and the exported PDF, so both always agree on breaks and page numbers.
 */

export type FontKey = "regular" | "italic" | "bold" | "boldItalic";

export type ImageSourceKind = "print" | "view" | "master";

export type BookImage = {
  fileId: string;
  label: string;
  /** Storage path inside the private `scans` bucket. */
  path: string;
  source: ImageSourceKind;
  derivativeId: string | null;
  width: number;
  height: number;
  /** Signed preview URL (viewing copy) — only present in preview payloads. */
  previewUrl?: string | null;
  /** Storage bucket; archive scans and gallery photos live in `scans`, book uploads in `book-images`. */
  bucket?: "scans" | "book-images";
};

export type BookRecordSource = {
  type?: "record";
  itemId: string;
  letterId: string;
  archiveId: string;
  dateLabel: string | null;
  sortDate: string | null;
  author: string | null;
  recipient: string | null;
  location: string | null;
  /** Mailing origin and destination exactly as catalogued (never inferred). */
  origin: string | null;
  destination: string | null;
  title: string | null;
  scans: BookImage[];
  envelopes: BookImage[];
  transcription: string;
  transcriptionVerified: boolean;
  fingerprint: string;
  storedFingerprint: string | null;
  updatedAt: string | null;
  thumbUrl?: string | null;
  hasEnvelopeFlag: boolean;
  /** Per-scan transcription text keyed by file id (for facing-page layout). */
  pageTexts?: Record<string, string>;
};

export type BookSettings = {
  scansPerPage: 1 | 2;
  titlePage: boolean;
  /** Classic Literary — Envelope First (default). Off = original Phase 1 order. */
  envelopeFirst: boolean;
  /** Phase 3 — each scan on a left page with its own transcription facing it. */
  facing?: boolean;
  theme?: string;
  printer?: string;
  toc?: { enabled: boolean; records: boolean };
  front?: { colophon: boolean; colophonText: string; dedication: string };
};

export type BookMeta = {
  id: string;
  title: string;
  subtitle: string | null;
  trimWidthIn: number;
  trimHeightIn: number;
  settings: BookSettings;
};

export type TextRun = {
  t: "text";
  x: number;
  /** Baseline, measured in points from the top of the page. */
  y: number;
  size: number;
  font: FontKey;
  text: string;
  tone: Tone;
  /** Rotated 90° clockwise, reading top to bottom (spine text). */
  rotate?: boolean;
};
export type Tone = "ink" | "muted" | "note" | "paper";

export type ImageBox = {
  t: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  image: BookImage;
  dpi: number;
  /** Visible area; the image is drawn larger and cropped to it on screen and in print (Fill / Full-bleed). */
  clip?: { x: number; y: number; w: number; h: number };
};

export type Rule = { t: "rule"; x: number; y: number; w: number };

/** Solid colour fill (covers only). */
export type Fill = { t: "fill"; x: number; y: number; w: number; h: number; color: [number, number, number] };

export type PageElement = TextRun | ImageBox | Rule | Fill;

export type PlannedPage = {
  index: number; // 1-based physical page
  folio: number | null; // printed page number (null = suppressed)
  kind: "title" | "blank" | "scan" | "envelope" | "text" | "custom" | "chapter" | "toc" | "front" | "cover";
  itemId: string | null;
  archiveId: string | null;
  elements: PageElement[];
};

export type BookWarning = {
  level: "error" | "warning" | "info";
  archiveId: string | null;
  itemId: string | null;
  message: string;
};

export type BookPlan = {
  widthPt: number;
  heightPt: number;
  pages: PlannedPage[];
  warnings: BookWarning[];
  /** Bleed beyond the trim on each outside edge (0 = none). Full-bleed images extend into it. */
  bleedPt?: number;
  /** Margins actually used (theme + printer gutter), for preview guides and preflight. */
  margins?: { top: number; bottom: number; inside: number; outside: number };
  tones?: Record<Tone, [number, number, number]>;
  /** Blank pages appended to meet the printer's page-count rule. */
  paddedPages?: number;
};

export const PRINT_DPI_GOOD = 300;
export const PRINT_DPI_MIN = 200;

// ---- Phase 2: custom pages --------------------------------------------------

export type ImageMode = "fit" | "fill" | "bleed";
export type TextStyle = "heading" | "body" | "caption" | "quote" | "note";

/** Where an image on a custom page comes from. Archive and gallery images are referenced, never copied. */
export type ImageRef =
  | { source: "archive"; fileId: string; archiveId?: string; label?: string; w?: number; h?: number }
  | { source: "gallery"; photoId: string; side: "front" | "back"; label?: string; w?: number; h?: number }
  | { source: "upload"; path: string; viewPath: string; name?: string; w: number; h: number };

export type PageTextBox = {
  id: string;
  kind: "text";
  x: number; y: number; w: number; h: number;
  z?: number;
  text: string;
  style: TextStyle;
  align: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
};
export type PageImageBox = {
  id: string;
  kind: "image";
  x: number; y: number; w: number; h: number;
  z?: number;
  ref: ImageRef | null;
  mode: ImageMode;
  caption?: string;
};
export type PageBox = PageTextBox | PageImageBox;

export type CustomPageDoc = {
  template: string;
  name?: string;
  /** Print the page number (off for dividers, dedications and full-bleed pages). */
  folio: boolean;
  boxes: PageBox[];
  /** Long-form research: text that flows across as many pages as it needs. */
  flow?: { heading?: string; text: string } | null;
};

export type BookPageSource = {
  type: "page";
  itemId: string;
  doc: CustomPageDoc;
  /** Resolved images keyed by box id (null = missing / not chosen yet). */
  images: Record<string, BookImage | null>;
  fingerprint: string;
  storedFingerprint: string | null;
};

// ---- Phase 3: chapters and covers -------------------------------------------

export type ChapterDoc = { title: string; subtitle?: string; epigraph?: string; epigraphSource?: string };
export type BookChapterSource = { type: "chapter"; itemId: string; doc: ChapterDoc };

export type CoverDoc = {
  template: "classic" | "photo" | "cloth";
  title: string;
  subtitle: string;
  author: string;
  backText: string;
  spineText: boolean;
  image: ImageRef | null;
};

export type BookEntry = BookRecordSource | BookPageSource | BookChapterSource;
export const isPageEntry = (e: BookEntry): e is BookPageSource => e.type === "page";
export const isChapterEntry = (e: BookEntry): e is BookChapterSource => e.type === "chapter";
export const isRecordEntry = (e: BookEntry): e is BookRecordSource => (e.type ?? "record") === "record";
export const recordEntries = (es: BookEntry[]) => es.filter(isRecordEntry);
