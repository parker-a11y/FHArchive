# Remove unnecessary line breaks in transcriptions

Add a one-click cleanup that joins broken-up lines back into flowing paragraphs, so older transcriptions can be tidied without re-running the AI.

## What you'll see

- On each page in the Transcription review area, a new button next to "Transcribe with ChatGPT": **Remove line breaks**.
- Pressing it rewrites the text in the edit box only. Nothing is saved until you press **Save Corrections** or **Mark Human Verified**, so you can undo by leaving the page without saving.
- A **Remove line breaks on all pages** button at the top of the Transcription section for whole-record cleanup (still unsaved until you save/verify).
- Nothing about verification status changes: a page already marked Human Verified stays verified, and using this button never sends anything back to the AI.

## How the cleanup works

- Lines inside a paragraph are joined with a single space when the previous line clearly continues (no ending punctuation, next line starts lower-case or continues a sentence).
- Blank lines are kept as real paragraph breaks.
- Words split across a line with a hyphen are rejoined.
- Short structural lines are left alone: dates, place/heading lines at the top, salutations ("Darling -"), closings, signatures, postscript markers, and address/stamp blocks.
- Original spelling, punctuation, capitalization, and wording are untouched.

## Technical notes

- New pure helper `reflowTranscription(text)` in `src/lib/transcription-format.ts` (no server call, no AI credits).
- `src/components/letter/TranscriptionPanel.tsx`: per-page button calls the helper on the local editor text and sets the dirty flag, so the existing unsaved-corrections indicator and Verify All dirty handling already cover it; record-level button loops over the mounted page editors via the existing text-state registry.
- No database or schema changes; stored text only changes when the user saves.
