// Timeline Summary Export: one row per record with catalog details, the long
// summary and the people mentioned. Pure builders so CSV/DOC/PDF stay in sync.

export type SummaryExportRow = {
  date: string;
  sortDate: string | null;
  archiveId: string;
  title: string;
  from: string;
  to: string;
  origin: string;
  destination: string;
  summary: string;
  people: string[];
};

export const PUBLIC_RECORD_BASE = "https://fharchive.com/record/";

/** No-login, read-only link for one record, keyed by its FH number. */
export function publicRecordUrl(archiveId: string): string {
  return PUBLIC_RECORD_BASE + encodeURIComponent(archiveId);
}

/** No-login plain-text transcription only. */
export function publicTranscriptionUrl(archiveId: string): string {
  return publicRecordUrl(archiveId) + "/transcription";
}

export function sortExportRows(rows: SummaryExportRow[]): SummaryExportRow[] {
  return [...rows].sort((a, b) => {
    if (a.sortDate && b.sortDate && a.sortDate !== b.sortDate) return a.sortDate < b.sortDate ? -1 : 1;
    if (a.sortDate && !b.sortDate) return -1;
    if (!a.sortDate && b.sortDate) return 1;
    return a.archiveId.localeCompare(b.archiveId);
  });
}

const CSV_HEADERS = ["Date", "Record", "Title", "From", "To", "Mailing Origin", "Mailing Destination", "Summary", "People Mentioned", "Public Link", "Transcription Link"];

function csvCell(v: string) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildCsv(rows: SummaryExportRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [r.date, r.archiveId, r.title, r.from, r.to, r.origin, r.destination, r.summary, r.people.join("; "), publicRecordUrl(r.archiveId), publicTranscriptionUrl(r.archiveId)]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM so Excel reads accented names correctly.
  return "\uFEFF" + lines.join("\r\n");
}

/** Plain-text block per record, shared by PDF and DOC so both read identically. */
export function recordFields(r: SummaryExportRow): [string, string][] {
  return [
    ["Date", r.date],
    ["From", r.from],
    ["To", r.to],
    ["Mailing Origin", r.origin],
    ["Mailing Destination", r.destination],
    ["People Mentioned", r.people.length ? r.people.join("; ") : "None recorded"],
    ["Public Link", publicRecordUrl(r.archiveId)],
    ["Transcription Link", publicTranscriptionUrl(r.archiveId)],
  ];
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildDocHtml(rows: SummaryExportRow[], heading: string): string {
  const body = rows
    .map((r) => {
      const fields = recordFields(r)
        .map(([k, v]) => `<b>${k}:</b> ${esc(v)}<br/>`)
        .join("");
      return `<h2>${esc(r.archiveId)}${r.title ? ` — ${esc(r.title)}` : ""}</h2><p>${fields}</p><p><b>Summary:</b> ${esc(r.summary)}</p><hr/>`;
    })
    .join("\n");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(heading)}</title>
<style>body{font-family:Georgia,serif;font-size:11pt;line-height:1.4}h1{font-size:18pt}h2{font-size:13pt;margin:14pt 0 4pt}p{margin:2pt 0}</style></head>
<body><h1>${esc(heading)}</h1><p>${rows.length} records, in date order.</p>${body}</body></html>`;
}
