/* ---------------- Record types & subtypes ---------------- */

export const RECORD_TYPES = [
  { value: "letter", label: "Letter / Correspondence" },
  { value: "photograph", label: "Photograph" },
  { value: "military", label: "Military Record" },
  { value: "government", label: "Government / Official Document" },
  { value: "family", label: "Personal / Family Document" },
  { value: "program", label: "Program / Invitation" },
  { value: "newspaper", label: "Newspaper / Clipping" },
  { value: "financial", label: "Financial Record" },
  { value: "employment", label: "Employment Record" },
  { value: "education", label: "Education Record" },
  { value: "travel", label: "Travel Document" },
  { value: "ephemera", label: "Ephemera" },
  { value: "artifact", label: "Artifact / Object" },
  { value: "medal", label: "Medal / Decoration" },
  { value: "insignia", label: "Pin / Insignia" },
  { value: "scrapbook", label: "Scrapbook Material" },
  { value: "media", label: "Audio / Video" },
  { value: "research", label: "Research Material" },
  { value: "other", label: "Other" },
] as const;


/** Subtypes per record type — add new entries freely; unknown types fall back to Other. */
export const SUBTYPES: Record<string, readonly string[]> = {
  letter: [
    "Personal letter",
    "V-Mail",
    "Postcard",
    "Telegram",
    "Greeting card",
    "Official correspondence",
    "Envelope only",
    "Enclosure",
    "Other",
  ],
  photograph: [
    "Portrait",
    "Family",
    "Military",
    "Group",
    "Event",
    "Travel",
    "Location",
    "Snapshot",
    "Formal / Studio",
    "Unknown",
  ],
  military: [
    "Orders",
    "Assignment",
    "Personnel Record",
    "Appointment / Commission",
    "Promotion",
    "Training",
    "Medical / Physical",
    "Pay",
    "Leave",
    "Discharge / Separation",
    "Award / Citation",
    "Ship Record",
    "Muster / Personnel Roster",
    "Official Correspondence",
    "Official Photograph",
    "Map",
    "Other",
  ],
  government: [
    "Birth certificate",
    "Marriage certificate",
    "Death certificate",
    "Census record",
    "Immigration / Naturalization",
    "Court record",
    "Tax record",
    "License / Permit",
    "Social Security",
    "Other",
  ],
  family: [
    "Diary / Journal",
    "Address book",
    "Recipe",
    "Family tree / Genealogy",
    "Scrapbook page",
    "Religious record",
    "Invitation / Announcement",
    "Memorial / Funeral",
    "Other",
  ],
  newspaper: ["Article", "Obituary", "Announcement", "Advertisement", "Photograph", "Other"],
  financial: [
    "Receipt",
    "Bank record",
    "Bond / Savings",
    "Insurance",
    "Bill / Invoice",
    "Will / Estate",
    "Property / Deed",
    "Other",
  ],
  employment: [
    "Application",
    "Contract",
    "Pay record",
    "Union record",
    "Identification",
    "Retirement / Pension",
    "Correspondence",
    "Other",
  ],
  education: [
    "Diploma / Certificate",
    "Transcript",
    "Report card",
    "Yearbook",
    "Enrollment",
    "Award",
    "Other",
  ],
  travel: ["Passport", "Visa", "Ticket", "Itinerary", "Map", "Souvenir", "Other"],
  ephemera: ["Program", "Menu", "Ticket stub", "Pamphlet", "Postcard", "Label / Tag", "Other"],
  artifact: ["Uniform item", "Jewelry", "Tool", "Textile", "Flag / Banner", "Other"],
  program: ["Program", "Invitation", "Announcement", "Menu", "Order of service", "Other"],
  medal: ["Campaign medal", "Service medal", "Decoration", "Ribbon", "Citation bar", "Other"],
  insignia: ["Rank insignia", "Unit insignia", "Collar device", "Pin", "Patch", "Button", "Other"],
  scrapbook: ["Scrapbook page", "Loose clipping", "Mounted photograph", "Keepsake", "Other"],
  media: ["Audio recording", "Film", "Video", "Interview", "Other"],
  research: ["Notes", "Article", "Book excerpt", "Web source", "Correspondence", "Other"],
  other: ["Other"],
};

export function subtypesFor(recordType: string): readonly string[] {
  return SUBTYPES[recordType] ?? ["Other"];
}

export const ORIGINAL_COPY = [
  { value: "original", label: "Original" },
  { value: "copy", label: "Copy" },
  { value: "unknown", label: "Unknown" },
] as const;

export const RECORD_RESEARCH_STATUS = [
  { value: "unreviewed", label: "Unreviewed" },
  { value: "reviewed", label: "Reviewed" },
  { value: "needs_research", label: "Needs Research" },
  { value: "verified", label: "Verified" },
] as const;

export const PRIMARY_PERSONS = [
  { value: "", label: "—" },
  { value: "Francis A. Harrington", label: "Francis" },
  { value: "Jacqueline Harrington", label: "Jacqueline" },
  { value: "Francis & Jacqueline", label: "Francis & Jacqueline" },
  { value: "Other", label: "Other" },
] as const;

export const ORG_TYPES = [
  { value: "ship", label: "Ship" },
  { value: "military_unit", label: "Military Unit" },
  { value: "military_installation", label: "Military Installation" },
  { value: "school", label: "School" },
  { value: "employer", label: "Employer" },
  { value: "church", label: "Church / Religious" },
  { value: "government", label: "Government Agency" },
  { value: "club", label: "Club / Association" },
  { value: "other", label: "Other" },
] as const;

export const EVENT_TYPES = [
  { value: "military", label: "Military Service" },
  { value: "family", label: "Family Event" },
  { value: "birth", label: "Birth" },
  { value: "death", label: "Death" },
  { value: "marriage", label: "Marriage" },
  { value: "travel", label: "Trip / Travel" },
  { value: "residence", label: "Move / Residence" },
  { value: "historical", label: "Historical Event" },
  { value: "other", label: "Other" },
] as const;

/** True when the record should show correspondence-specific fields. */
export function isLetterType(recordType: string | null | undefined) {
  return (recordType ?? "letter") === "letter";
}

/** Date status / precision. A record is always valid with no date at all. */
export const DATE_PRECISION = [
  { value: "exact", label: "Exact date" },
  { value: "month", label: "Month and year" },
  { value: "year", label: "Year only" },
  { value: "approximate", label: "Approximate (circa)" },
  { value: "range", label: "Date range" },
  { value: "undated", label: "Undated" },
  { value: "not_applicable", label: "Not applicable" },
  { value: "unknown", label: "Unknown" },
] as const;

export const IDENTIFICATION_STATUS = [
  { value: "identified", label: "Identified" },
  { value: "partial", label: "Partially Identified" },
  { value: "probable", label: "Probable" },
  { value: "possible", label: "Possible" },
  { value: "unidentified", label: "Unidentified" },
  { value: "needs_research", label: "Needs Research" },
] as const;

export const STORAGE_TYPES = [
  { value: "", label: "—" },
  { value: "file_jacket", label: "File Jacket" },
  { value: "archival_sleeve", label: "Archival Sleeve" },
  { value: "photo_sleeve", label: "Photo Sleeve" },
  { value: "artifact_box", label: "Artifact Box" },
  { value: "document_box", label: "Document Box" },
  { value: "oversize", label: "Oversize Storage" },
  { value: "other", label: "Other" },
] as const;


export const DATE_CERTAINTY = [
  { value: "confirmed", label: "Exact / Confirmed" },
  { value: "probable", label: "Probable" },
  { value: "approximate", label: "Approximate" },
  { value: "estimated", label: "Estimated" },
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

export const ITEM_TYPES = [
  { value: "letter", label: "Letter / Note" },
  { value: "invitation", label: "Invitation" },
  { value: "program", label: "Program / Agenda" },
  { value: "photograph", label: "Photograph" },
  { value: "envelope", label: "Envelope" },
  { value: "clipping", label: "Newspaper clipping" },
  { value: "document", label: "Document" },
  { value: "card", label: "Card" },
  { value: "ephemera", label: "Ephemera" },
  { value: "artifact", label: "Artifact" },
  { value: "other", label: "Other" },
] as const;

export const ITEM_SIDES = [
  { value: "", label: "—" },
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "both", label: "Front & Back" },
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
