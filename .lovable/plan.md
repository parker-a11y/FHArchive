# Email from the All Records table

Add email capability directly to the All Records page (`/letters`) so records can be emailed without opening each detail page.

## Changes

**File: `src/routes/letters/index.tsx`**

1. **Per-row Email button** — in the FH ID cell (next to the FH number link and status dot), add a small mail-icon button that opens the existing `EmailArchiveDialog` for that record (`kind: "letter"`, id, archive_id, title). Clicking it does not navigate away from the table.

2. **Multi-record email** — add a checkbox column at the far left of the table plus a "Select all" checkbox in the header. When one or more rows are checked, an **Email selected (n)** button appears in the filter bar. It opens `EmailArchiveDialog` preloaded with all selected records — the existing `sendArchiveEmail` server function already accepts a `records` array, so no backend change is needed.

**File: `src/components/letter/EmailArchiveDialog.tsx`**

3. Extend the dialog's props to accept an optional `records` array (`{ kind, id, identifier, title }[]`). Single-record usage stays unchanged; when multiple records are passed, the dialog description and default subject list them (e.g. "FH0002, FH0004, FH0007 from the Harrington Family Archive") and the send payload includes all of them.

## What does not change

- The Email buttons on record detail pages (FH and Digital Source) stay as they are.
- No changes to the email server function, templates, contacts, or `/emails` history page.
- Sending still requires the `notify.fharchive.com` domain to finish DNS verification; the buttons will be visible regardless.
