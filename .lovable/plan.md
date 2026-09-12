# Merge Save Corrections and Mark Human Verified into one button

## The change

On the Transcription tab of a record, each page currently has two buttons: **Save Corrections** (saves edits, leaves the page unverified) and **Mark Human Verified** (saves edits and verifies the page). Replace them with a single button: **Save & Mark Human Verified**.

- Pressing it saves the current text and marks the page Human Verified in one step — the behavior of today's "Mark Human Verified".
- The button turns green after a successful save, exactly as the verified button does today; editing the text afterward returns it to its normal color.
- If a page was already verified when opened, the button shows its green verified state as today.
- A failed save still shows the existing error message and leaves the button unchanged.

## What stays the same

- **Human Verify All** at the record level is unchanged — it still saves any pending edits and verifies all pages at once.
- The scan-level "Transcribe Selected" / bulk transcription flows never auto-verify; this change only affects the manual per-page save.
- Guests and read-only viewers see no buttons, as now.
- No database changes; the existing save function already handles save-and-verify.

## Technical details

- Only `src/components/letter/TranscriptionPanel.tsx` changes: remove the `save(false)` button, keep the single `save(true)` button, relabel it "Save & Mark Human Verified", and merge the `correctionsSaved` / `humanVerified` display state into one saved-and-verified indicator.
- `saveCorrections(id, text, true)` in `src/lib/transcription.ts` already performs the combined save + verify, so no library change is needed.

## Verification

Edit a page's transcription, click the single button, and confirm the page is saved and shows Human Verified (green), the record's status dot updates accordingly, and editing again reverts the button color.
