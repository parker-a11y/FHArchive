export type Col = { key: string; label: string; width: number; minWidth?: number; editable?: boolean };


export const COLUMNS: Col[] = [
  // Room for the record number, health dot and every action icon, including Notes.
  { key: "archive_id", label: "FH ID", width: 220, minWidth: 210 },
  { key: "collections", label: "Collections", width: 200 },
  { key: "record_type", label: "Type", width: 150 },
  { key: "subtype", label: "Subtype", width: 130 },
  { key: "title", label: "Title", width: 200, editable: true },
  { key: "date", label: "Date", width: 150 },
  { key: "date_precision", label: "Date status", width: 130 },
  { key: "destination", label: "Mailing destination", width: 180, editable: true },
  { key: "primary_person", label: "Primary person", width: 150, editable: true },
  { key: "author", label: "From", width: 150, editable: true },
  { key: "recipient", label: "To", width: 150, editable: true },
  { key: "origin", label: "Origin", width: 160, editable: true },
  { key: "storage", label: "Storage", width: 200 },
  { key: "sheets", label: "Sheets", width: 70, editable: true },
  { key: "image_count", label: "Images", width: 70 },
  { key: "has_envelope", label: "Env", width: 60 },
  { key: "digitization_status", label: "Digitization", width: 160 },
  { key: "scan_status", label: "Scan", width: 110 },
  { key: "transcription_status", label: "Transcription", width: 130 },
  { key: "tones", label: "Tone / sentiment", width: 200 },
  { key: "keywords", label: "Keywords", width: 180 },
  { key: "notes", label: "Notes", width: 220, minWidth: 120, editable: true },
];


export const DEFAULT_COLUMN_ORDER = COLUMNS.map((c) => c.key);
export const COLUMN_ORDER_KEY = "letters_column_order_v1";
