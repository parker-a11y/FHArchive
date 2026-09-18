# Add a scan to the transcription from the scans page

Envelopes (and anything labelled "envelope") are deliberately skipped by transcription today, so their text never reaches the record. This adds a per-scan opt-in on the Original TIFFs page.

## What you'll see

On each scan card in "Original TIFFs" — right where the label buttons are — a new **ADD TO TRANSCRIPTION** button appears for scans that are currently excluded (envelopes) or not yet transcribed.

Pressing it:
1. Marks that scan as included in the record's transcription.
2. Transcribes it with AI (the original scan is never altered).
3. Folds the result into the record transcription in scan order, with its label (e.g. "Envelope") kept as the page heading.
4. Shows a toast, and the button flips to an "Included — remove" state so you can undo it. Removing takes the page back out of the record transcription; the page's own transcription text is kept.

Nothing changes for normal letter pages: they keep transcribing as they do now, and envelopes stay excluded unless you press the button.

## Technical notes

- Migration: add `include_in_transcription boolean` (default false) to `digital_files`. No new grants/policies needed beyond the table's existing ones.
- `src/lib/transcription.server.ts`
  - `resolveScanTargets`: skip envelope files only when `include_in_transcription` is not true.
  - `rebuildRecordTranscription`: same override in the ordered-pages filter.
- `src/lib/transcription.functions.ts`: new `setScanIncludedInTranscription` server fn (auth middleware) that flips the flag, optionally transcribes the scan when it has no text yet, then calls `rebuildRecordTranscription`.
- `src/lib/transcription.ts`: type addition only.
- `src/components/letter/DigitizationPanel.tsx`: new button + pending state per file, wired to the new server fn; refetch scan transcriptions/record after success.
- `transcribeRecord` keeps its existing envelope filter but honours the flag through the same helper.
