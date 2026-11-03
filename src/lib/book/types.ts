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
};

export type BookRecordSource = {
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
};

export type BookSettings = {
  scansPerPage: 1 | 2;
  titlePage: boolean;
  /** Classic Literary — Envelope First (default). Off = original Phase 1 order. */
  envelopeFirst: boolean;
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
  tone: "ink" | "muted";
};

export type ImageBox = {
  t: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  image: BookImage;
  dpi: number;
};

export type Rule = { t: "rule"; x: number; y: number; w: number };

export type PageElement = TextRun | ImageBox | Rule;

export type PlannedPage = {
  index: number; // 1-based physical page
  folio: number | null; // printed page number (null = suppressed)
  kind: "title" | "blank" | "scan" | "envelope" | "text";
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
};

export const PRINT_DPI_GOOD = 300;
export const PRINT_DPI_MIN = 200;
