export const DATE_PRECISION = [
  { value: "exact", label: "Exact" },
  { value: "month", label: "Month only" },
  { value: "year", label: "Year only" },
  { value: "approximate", label: "Approximate" },
  { value: "unknown", label: "Unknown" },
] as const;

export const DATE_CERTAINTY = [
  { value: "confirmed", label: "Confirmed" },
  { value: "probable", label: "Probable" },
  { value: "possible", label: "Possible" },
  { value: "unknown", label: "Unknown" },
] as const;

export const PERIODS = [
  { value: "prewar", label: "Prewar" },
  { value: "wartime", label: "Wartime" },
  { value: "postwar", label: "Postwar" },
  { value: "unknown", label: "Unknown" },
] as const;

export const TRANSCRIPTION_STATUS = [
  { value: "not_started", label: "Not Started" },
  { value: "ai_transcribed", label: "AI Transcribed" },
  { value: "needs_review", label: "Needs Review" },
  { value: "human_verified", label: "Human Verified" },
] as const;

export const SCAN_STATUS = [
  { value: "not_scanned", label: "Not Scanned" },
  { value: "partial", label: "Partial" },
  { value: "scanned", label: "Scanned" },
] as const;

export const REVIEW_STATUS = [
  { value: "not_reviewed", label: "Not Reviewed" },
  { value: "in_progress", label: "In Progress" },
  { value: "reviewed", label: "Reviewed" },
] as const;

export const PUBLICATION_STATUS = [
  { value: "private", label: "Private" },
  { value: "candidate", label: "Candidate for Publication" },
  { value: "approved", label: "Approved for Publication" },
] as const;

export const IMAGE_TYPES = [
  { value: "page_front", label: "Page Front" },
  { value: "page_back", label: "Page Back" },
  { value: "envelope_front", label: "Envelope Front" },
  { value: "envelope_back", label: "Envelope Back" },
  { value: "enclosure", label: "Enclosure" },
  { value: "other", label: "Other" },
] as const;

export const REFERENCE_TYPES = [
  "Person",
  "Military unit",
  "Ship",
  "Place",
  "Historical event",
  "Organization",
  "Book",
  "Newspaper",
  "Other",
] as const;

export const RESEARCH_STATUS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "dead_end", label: "Dead End" },
] as const;

export const RELATION_TYPES = [
  "Reply to",
  "Response from",
  "Mentions previous letter",
  "Same event",
  "Same trip",
  "Same location",
  "Same subject",
  "Other",
] as const;

export const AI_FIELDS = [
  { key: "summary_short", label: "Short summary" },
  { key: "summary_long", label: "Detailed summary" },
  { key: "keywords", label: "Suggested keywords" },
  { key: "people", label: "People mentioned" },
  { key: "places", label: "Places mentioned" },
  { key: "units", label: "Military units" },
  { key: "ships", label: "Ships" },
  { key: "organizations", label: "Organizations" },
  { key: "events", label: "Historical events" },
  { key: "quotations", label: "Important quotations" },
  { key: "uncertain", label: "Uncertain transcription passages" },
  { key: "questions", label: "Potential research questions" },
  { key: "related", label: "Related letters" },
] as const;

export function labelOf(
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return list.find((i) => i.value === value)?.label ?? "—";
}

export function formatArchiveId(seq: number) {
  return "FH" + String(seq).padStart(4, "0");
}

const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

/** Label date rendering honouring precision/certainty — never invents precision. */
export function labelDate(letter: {
  normalized_date: string | null;
  date_precision: string;
  date_certainty: string;
}) {
  const d = letter.normalized_date;
  if (!d) return "DATE UNKNOWN";
  const [y, m, day] = d.split("-").map(Number);
  const approx = letter.date_precision === "approximate" || letter.date_certainty === "possible";
  if (letter.date_precision === "year" || letter.date_precision === "unknown")
    return (approx ? "c. " : "") + y;
  if (letter.date_precision === "month")
    return (approx ? "c. " : "") + `${MONTHS[m - 1]} ${y}`;
  return (approx ? "c. " : "") + `${MONTHS[m - 1]} ${day}, ${y}`;
}

export function displayDate(letter: {
  normalized_date: string | null;
  date_as_written?: string | null;
  date_precision: string;
  date_certainty: string;
}) {
  if (!letter.normalized_date) return letter.date_as_written || "Unknown date";
  const base = labelDate(letter);
  return base.charAt(0) + base.slice(1).toLowerCase();
}

export function scanFileLabel(archiveId: string, imageType: string, index: number) {
  if (imageType === "envelope_front") return `${archiveId}_ENV-F`;
  if (imageType === "envelope_back") return `${archiveId}_ENV-B`;
  if (imageType === "enclosure") return `${archiveId}_ENC-${String(index).padStart(2, "0")}`;
  return `${archiveId}_${String(index).padStart(3, "0")}`;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join(
    "\r\n",
  );
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Excel-compatible single-sheet XML workbook (SpreadsheetML 2003). */
export function toExcelXml(rows: Record<string, unknown>[], columns: string[]) {
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const cell = (v: unknown) => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  const body = rows
    .map((r) => `<Row>${columns.map((c) => cell(r[c])).join("")}</Row>`)
    .join("");
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Archive"><Table><Row>${columns
    .map(cell)
    .join("")}</Row>${body}</Table></Worksheet></Workbook>`;
}
