# Quick Entry reorder, remembered subtype, and scans at intake

Five changes to the Catalog (Quick Entry) page. Nothing about the record detail page changes except that fields moved there already exist.

## 1. Remember the letter subtype

When you save a Letter / Correspondence record with subtype "Personal", the next new record starts on Letter + Personal automatically. Remembered in this browser alongside the storage-location memory already in place, so it survives a page reload, not just the session.

## 2. Dates come first

After Record type and Subtype, the next boxes are the date group: Date, End date, Date as written (with the NONE button), Date status, Certainty. Everything else — Primary person, Title, Period, Identification, From/To, postal, storage — follows in its current order below. The date box keeps the auto-focus it has today.

## 3. Scans on the Catalog page

A file picker (drag-and-drop, multiple files) at the top of the form, under the FH number. Chosen files show as a list with remove buttons. On save the record is created first, then each file is uploaded and attached to the new FH record, with a small progress line. Labeling each scan (Page 1 Front, Envelope, etc.) still happens on the record page — intake just gets the images in. If an upload fails, the record still saves and the failure is named in the warning toast, matching how photo intake already behaves.

## 4. Mentions moves to the record page

Removed from Quick Entry. It already exists on the record page under Primary Person, so nothing new is added there.

## 5. Related records and Tone move to the record page

Both removed from Quick Entry. Related records already has a panel on the record page; Tone / sentiment already appears in the record's catalog form. So after "Save & open record" you land on the page that holds all three.

## Technical notes

- `src/routes/_authenticated/catalog.tsx`:
  - Extend the existing `localStorage` memory (`readLastStorage`/`rememberStorage`) with `record_type` and `subtype`; apply in `loadNext()` and keep the current post-save carry-over.
  - Reorder the JSX grid: record type, subtype, then the whole date block, then primary person, title, period, identification, letter fields.
  - Delete the Mentions, Related records, and Tone blocks plus the `mentions`/`relations` state, `PersonMultiSelect`/`RelatedRecordsField`/`ToneMultiSelect` imports, the `mentioned` role-link loop, and the `addRecordLink` loop. `extras.tones` becomes `[]`.
  - Add `pendingFiles: File[]` state + a dropzone modeled on `PhotoIntakeForm`'s; after `createRecord` and the `extras` update, upload sequentially and push any error into `followUpErrors`.
- Upload path: reuse the existing digitization upload used by `DigitizationPanel` (extract its per-file upload into a shared helper in `src/lib/digitization.ts` if it is currently inline in the component), so masters, JPEG derivatives, and thumbnails are produced exactly as today — no duplicate logic.
- No migration; no schema change.
