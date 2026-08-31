# Roll page transcriptions up into the record transcription

## Answer: no, this has not been fixed

Confirmed in the code and data:

- Only the "Transcribe Entire Record" button writes a combined record-level transcription (`letters.transcription_raw_ai`). Transcribing individual scans, or correcting/verifying a page, writes only to the page row and never updates the record.
- Every one of the 11 records with page transcriptions has all pages human-verified, yet the record-level verified transcription is empty on all 11. Shared pages and emails therefore fall back to the older AI text, so any page-level correction you made is not reflected.

## The fix

1. **Roll up automatically whenever page text changes.** After transcribing selected scans, saving page corrections, marking a page human verified, or "Human Verify All", rebuild the record transcription from the pages in scan order (envelope pages still excluded, same as today).
2. **Write to the right field.** If every non-envelope page with text is human-verified, the combined text is saved as the record's verified transcription and the record status becomes human verified; otherwise it is saved as the AI transcription with the AI status. This keeps the raw AI text and corrected text separate, as now.
3. **Never silently overwrite hand-edited text.** If the combined verified transcription in the editor was manually edited and differs from the page roll-up, show a "Pages have changed — refresh combined transcription" action instead of overwriting.
4. **Backfill existing records.** Rebuild the combined transcription for all 11 existing records from their verified page text, so shared links, the "Show transcription" button, and emails immediately show the corrected text.

## Technical notes

- Add a shared `buildCombinedTranscription(letterId)` helper (server-side, in the transcription module) that reads `scan_transcriptions` joined to `digital_files` order, prefers `verified_text` over `ai_text`, skips envelope pages via the existing `isEnvelopePage` rule, and updates `letters.transcription_raw_ai` / `transcription_verified` / `transcription_status`.
- Call it at the end of `transcribeScans` (grouped by letter) in `src/lib/transcription.functions.ts`, and after `saveCorrections` / `verifyAll` in `src/components/letter/TranscriptionPanel.tsx`, then invalidate the letter query.
- Backfill as a one-time SQL update assembling page text per letter.
- Verify: FH0011's shared `/s/<token>` page and a test email show the current verified page text; editing a page and saving updates the record text.
