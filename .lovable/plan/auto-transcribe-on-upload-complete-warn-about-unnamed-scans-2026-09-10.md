# Auto-transcribe on upload complete, warn about unnamed scans

Two changes to the scans area (Scans & Files panel, also used on the Catalog quick-entry page).

## 1. Warning when scans are not labelled

Today, pressing **Confirm Upload Complete** silently renumbers any scan that has no
label (Page 1 Front, Envelope Front, etc.).

New behaviour: if one or more scans still have no label, a confirmation appears first:

- Names the count and lists the first few unlabelled scans
- **Go back and label** (default) closes the dialog and jumps to the first unlabelled scan
- **Continue anyway** proceeds exactly as it does today (sequential numbering)

If every scan is labelled, nothing changes — confirming runs straight through.

## 2. Automatic transcription after processing finishes

Once the viewing copies and thumbnails are generated successfully, the record is sent
for transcription automatically when all of these are true:

- The record's transcription status is not "Transcription Not Required"
- The record has at least one non-envelope page (envelopes are never transcribed)
- There are pages without transcribed text yet

It runs the same non-forcing record transcription used by the Transcription tab, so
existing text is never overwritten. Nothing is accepted or human-verified — the record
simply arrives in the Transcription tab ready for review. A toast reports progress and
the outcome, and a failure only shows a message; the scans and derivatives are unaffected.

## Technical notes

- `src/components/letter/DigitizationPanel.tsx`
  - New `confirmDialogOpen` state; the **Confirm Upload Complete** button opens the
    unlabelled-scan dialog (shadcn `AlertDialog`) when `unnamed.length > 0`, otherwise
    calls `confirmUploadComplete()` directly. "Go back and label" reuses `jumpToScan`.
  - At the end of `confirmUploadComplete()`, in the `ok && !failed` branch, call a new
    `maybeAutoTranscribe()` after `patchLetter({ digitization_status: "complete" })`.
  - `maybeAutoTranscribe()` guards on `letter.transcription_status !== "not_required"`,
    uses the existing envelope test from `src/lib/transcription.ts` over the refreshed
    file list to confirm there is a transcribable page, then awaits
    `transcribeRecord({ data: { letterId: letter.id, force: false } })` from
    `@/lib/transcription.functions` with a busy state on the confirm button, and
    invalidates `["scan-transcriptions", letter.id]` plus the letter query.
- No schema change, no migration, no change to masters or derivative logic.
