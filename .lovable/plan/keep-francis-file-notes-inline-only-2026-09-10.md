# Keep Francis File Notes inline only

## Goal
Francis File Notes will appear only as a yellow highlight on the exact recognized word or phrase within the text. Clicking that highlighted term will continue to open the note.

## Changes
- Remove the separate **Published Notes preview** section from every editing and transcription screen.
- Remove all uses of that preview from record details, transcription review, archive notes, research panels, related-record notes, Digital Sources, people, places, and photograph fields.
- Keep the shared inline Francis File Note renderer everywhere archive text is displayed, including transcription areas, summaries, search results, Ask Francis, recaps, quotations, and shared/public views.
- Keep matching behavior unchanged: only the recognized term is highlighted, stored text is not modified, and clicking the term opens its Francis File Note.

## Verification
- Confirm transcription review no longer shows a duplicate preview section.
- Confirm a recognized term inside the transcription itself remains highlighted and clickable.
- Check other editing screens for any remaining **Published Notes preview** heading.
- Confirm the app builds cleanly.

## Technical detail
Remove the `FfnPreview` component and its imports/usages while retaining `FfnText` and the existing note popover behavior.
