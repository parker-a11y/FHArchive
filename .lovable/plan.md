# Add "Include envelope scan" option to the email dialog

When emailing record(s) from All Records (or a record page), add a third checkbox alongside "Include scan images" and "Include the transcription": **Include envelope scan**.

## Behavior

- New checkbox: "Include the envelope scan" — shown only when at least one selected record is a letter (hidden for Digital-Source-only emails).
- Default: **off** — envelope pages are excluded from the email images, so the email shows only the letter scans.
- When on: envelope scans (front/back) are included in the email images for each letter record, in addition to the letter pages, within the existing image limit (raise limit so letter pages aren't crowded out).

## Technical details

**`src/components/letter/EmailArchiveDialog.tsx`**
- Add `includeEnvelope` state (default `false`) and a third checkbox, shown when `recordList.some(r => r.kind === "letter")`.
- Pass `includeEnvelope` in the `sendArchiveEmail` payload.

**`src/lib/archive-email.functions.ts`**
- Accept and validate `includeEnvelope?: boolean`; forward into `buildRecords` opts.

**`src/lib/archive-email.server.ts`**
- `buildRecords` opts gain `includeEnvelope: boolean`.
- `letterImages(db, letterId, limit, includeEnvelope)`: also select `label` and `original_filename` on `digital_files`; skip files where `isEnvelopePage(label, original_filename)` (from `@/lib/transcription`) is true **unless** `includeEnvelope` is set. When included, keep natural `sort_order` ordering. Raise the per-record image cap from 4 to 6 when envelopes are included so letter pages are not displaced.

## What does not change

- Transcription/images checkboxes, multi-record selection, templates, share links, and the `/emails` history page.
- No database or storage changes.
