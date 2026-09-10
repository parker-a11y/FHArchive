# Transcription save-state button colors

## Change

Update each transcription page editor so its two actions clearly show their current state:

- **Save Corrections** turns green after the corrections save succeeds.
- **Mark Human Verified** turns green after verification succeeds, and is also green when the page was already human verified when opened.
- Editing the transcription afterward immediately returns both buttons to their normal colors, showing that the displayed text has changed since the last save or verification.
- A failed save or verification leaves the buttons unchanged and continues to show the existing error message.

Keep the current save, verification, Verify All, transcription, and AI-analysis behavior unchanged.

## Technical details

- Make the button appearance derive from the page transcription status plus the editor's existing `dirty` state.
- After a successful action, update the page editor's local saved/verified state immediately so the color changes without waiting for the refreshed record query.
- Use the archive's existing semantic success styling and preserve accessible focus, disabled, and hover states.

## Verification

Check an unverified page through this sequence: save corrections, verify it, edit the text again, and confirm the colors progress from normal to green and then revert immediately after the new edit.