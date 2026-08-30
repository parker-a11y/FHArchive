/**
 * Digitization / scanning workflow helpers.
 *
 * Archival principle: the FH number identifies the record, the three-digit
 * sequence identifies the image's position inside that record. Filenames are
 * preserved exactly as scanned so the collection can be reconstructed from the
 * files alone, without this database.
 */

export const DIGITIZATION_STATUS = [
  { value: "not_scanned", label: "Not Scanned" },
  { value: "in_progress", label: "Scanning / In Progress" },
  { value: "needs_review", label: "Scanned — Needs Review" },
  { value: "complete", label: "Digitization Complete" },
] as const;

export const DERIVATIVE_KINDS = {
  jpeg: "JPEG viewing copy",
  thumbnail: "Thumbnail",
  ocr_text: "OCR text",
  transcription: "Transcription",
  pdf: "PDF",
} as const;

export type DerivativeKind = keyof typeof DERIVATIVE_KINDS;

/** Master formats we keep byte-for-byte. TIFF is the expected archival master. */
export const MASTER_ACCEPT =
  "image/tiff,image/tif,.tif,.tiff,image/jpeg,image/png,image/webp,application/pdf";

export function isTiff(file: { name: string; type?: string }) {
  return /\.tiff?$/i.test(file.name) || /tiff?$/i.test(file.type ?? "");
}

export function isBrowserImage(mime: string | null | undefined, filename: string) {
  if (mime && /^image\/(jpeg|png|webp|gif)$/i.test(mime)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(filename);
}

/** FH0042 / FH-0042 / fh 0042 → FH0042 */
export function normalizeFh(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Reads `FH-0042_003.tif` style names. Returns the FH number found in the
 * filename (normalized) and the image sequence number, when present.
 */
export function parseScanFilename(filename: string): { fh: string | null; seq: number | null } {
  const base = filename.replace(/\.[^.]+$/, "");
  const m = base.match(/^\s*(FH[-_ ]?\d{3,6})[_-](\d{1,4})/i);
  if (m) return { fh: normalizeFh(m[1]), seq: Number(m[2]) };
  const fhOnly = base.match(/^\s*(FH[-_ ]?\d{3,6})/i);
  const seqOnly = base.match(/[_-](\d{1,4})\s*$/);
  return {
    fh: fhOnly ? normalizeFh(fhOnly[1]) : null,
    seq: seqOnly ? Number(seqOnly[1]) : null,
  };
}

export function formatSeq(seq: number | null | undefined) {
  return seq === null || seq === undefined ? "—" : String(seq).padStart(3, "0");
}

type CompletenessShape = {
  record_type: string | null;
  has_envelope: boolean;
  sheets: number | null;
  scan_both_sides: boolean;
  completeness_check: boolean;
  expected_scan_count: number | null;
};

/**
 * Advisory expected-scan count. Letters get a structured calculation from
 * envelope + sheets; every other record type only ever uses a count the
 * cataloguer chose to enter. Never a hard requirement.
 */
export function expectedScans(l: CompletenessShape): {
  expected: number | null;
  breakdown: string[];
  source: "calculated" | "manual" | null;
} {
  const isLetter = (l.record_type ?? "letter") === "letter";
  if (isLetter && l.completeness_check) {
    const breakdown: string[] = [];
    const sides = l.scan_both_sides ? 2 : 1;
    if (l.has_envelope) {
      breakdown.push("Envelope Front");
      if (l.scan_both_sides) breakdown.push("Envelope Back");
    }
    const sheets = Math.max(0, l.sheets ?? 0);
    for (let i = 1; i <= sheets; i++) {
      breakdown.push(`Sheet ${i} Front`);
      if (l.scan_both_sides) breakdown.push(`Sheet ${i} Back`);
    }
    const calculated = (l.has_envelope ? sides : 0) + sheets * sides;
    if (calculated > 0) return { expected: calculated, breakdown, source: "calculated" };
  }
  if (l.expected_scan_count && l.expected_scan_count > 0)
    return { expected: l.expected_scan_count, breakdown: [], source: "manual" };
  return { expected: null, breakdown: [], source: null };
}

/** Suggested (never required) labels, chosen by record type. */
export function suggestedLabels(recordType: string | null | undefined): string[] {
  switch (recordType ?? "letter") {
    case "letter":
      return [
        "Envelope Front",
        "Envelope Back",
        "Sheet 1 Front",
        "Sheet 1 Back",
        "Sheet 2 Front",
        "Sheet 2 Back",
        "Enclosure",
        "Photograph",
        "Other",
      ];
    case "photograph":
      return ["Front", "Back", "Mount / Frame", "Inscription", "Detail", "Other"];
    case "newspaper":
      return ["Clipping", "Full page", "Reverse", "Masthead / Date", "Other"];
    case "military":
    case "government":
    case "employment":
    case "education":
    case "financial":
      return ["Page 1", "Page 2", "Reverse", "Attachment", "Envelope", "Other"];
    case "program":
      return ["Cover", "Inside left", "Inside right", "Back cover", "Insert", "Other"];
    case "artifact":
    case "medal":
    case "insignia":
      return ["Front view", "Reverse view", "Side view", "Detail", "Maker's mark", "Other"];
    default:
      return ["Front", "Back", "Detail", "Page 1", "Page 2", "Other"];
  }
}

/** One-line, record-type-appropriate guidance shown above the uploader. */
export function digitizationHint(recordType: string | null | undefined): string {
  switch (recordType ?? "letter") {
    case "letter":
      return "Correspondence can use the completeness assistant below (envelope + sheets). It is advisory only — irregular letters are normal.";
    case "photograph":
      return "Track front and back if useful. Neither is required — many photographs only need one scan.";
    case "newspaper":
      return "Any number of scans. No expected count is assumed for clippings.";
    case "artifact":
    case "medal":
    case "insignia":
      return "Images here are usually different views of the same object rather than pages.";
    case "program":
      return "Any number of images. You may set an optional expected page count.";
    default:
      return "Any number of files. Set an optional expected count only if it is useful for this record.";
  }
}

export function usesPhotoSides(recordType: string | null | undefined) {
  return (recordType ?? "") === "photograph";
}

/** Stable, human-friendly filename sort so dropped batches import in page order. */
export function sortByFilename<T extends { name: string }>(items: T[]): T[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  return [...items].sort((a, b) => collator.compare(a.name, b.name));
}
