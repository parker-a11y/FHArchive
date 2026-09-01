# Fix: emailed transcription shows the old text

## What's happening

Confirmed in the database for FH0015:

- Page 2's page-level transcription says **G.Q.** (your correction, saved and human-verified).
- The record's **combined** transcription still says **P.Q.**

The email builds from the record-level combined transcription, not from the page transcriptions — so it sent the stale text. The record page shows your corrected page text, which is why it looked right on screen.

Why the combined text didn't update: when a page is edited, the app rebuilds the combined text, but it refuses to overwrite an existing combined transcription that differs from what the pages produce, on the assumption it was hand-edited. Instead it shows an amber "Pages have changed — Refresh combined transcription" notice. In practice that notice fires for every ordinary page correction, and it's easy to miss, so the combined text silently drifts out of date.

## The fix

1. **Remember what the roll-up last produced.** Store the combined text the system generated alongside the record. On the next rebuild, if the current combined text is still identical to that stored roll-up, the system knows nobody hand-edited it and updates it automatically — no notice, no click. The "hand-edited" warning then only appears when the combined text genuinely was typed over by a person.
2. **Keep the safety net.** Genuine hand edits are still never overwritten; the amber notice and the "Refresh combined transcription" button remain, and the notice gets stronger wording that says the emailed/shared version will use the older text until refreshed.
3. **Warn at send time.** In the email dialog, if a selected record's combined transcription is out of step with its pages, show an inline warning with a one-click "Use latest page text" so a stale transcription can't be emailed unnoticed.
4. **Repair existing records.** Re-run the roll-up across all records whose pages are fully verified and whose combined text was auto-generated, so FH0015 (and any other record with the same drift) is corrected now.

## Technical notes

- Migration: add `letters.transcription_rollup_text` (or a hash column) written by `rebuildRecordTranscription` on every successful update.
- `src/lib/transcription.server.ts`: conflict test becomes `existingVerified` non-empty AND not equal to the stored roll-up snapshot (normalized) — replacing the current compare against `combinedBest`/`combinedAi`. When not in conflict, always write `transcription_verified` from the pages, not only when all pages are verified.
- Backfill: one-time data update running the same composition for records where combined text differs from page composition and the pages are the authority.
- `src/components/letter/EmailArchiveDialog.tsx`: per-record staleness check against page transcriptions plus a refresh action calling `rollupRecordTranscription`.
- `src/lib/archive-email.server.ts` keeps reading `transcription_verified` — no change needed once the field stays current.
