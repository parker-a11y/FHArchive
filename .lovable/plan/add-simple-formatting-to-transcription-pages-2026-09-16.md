# Add simple formatting to transcription pages

## What will change
- Replace each editable page-transcription text box with a visual editor.
- Include only **bold**, *italic*, underline, strikethrough, and left/centre/right/justified alignment.
- Keep the existing **Save & Mark Human Verified**, Human Verify All, transcription, and correction workflows unchanged.
- Show saved formatting in the combined transcription, record views, email output, and shared/public views.
- Preserve old plain-text transcriptions without requiring conversion or re-transcription.

## Safeguards
- Store only a tightly allow-listed set of formatting; scripts, unsafe links, and unsupported markup remain blocked.
- Convert formatted text to plain readable text before AI analysis, search indexing, matching, and other text-only processing.
- Keep Francis Files Note term highlighting working within formatted transcription text.
- Disable **Remove line breaks** for a page once it contains formatting, because flattening rich text could remove intentional layout or marks.

## Technical details
- Reuse the existing sanitized rich-text foundation and add a compact transcription toolbar mode.
- Use the visual editor only for individual page corrections, as requested.
- Render page and combined transcription HTML through the existing safe rich-text viewer instead of exposing markup.
- Update rollup and downstream text consumers so formatting is retained for display but stripped where plain text is required.
- Add focused regression tests for sanitization, plain-text conversion, and combined formatted pages.

## Verification
- Format words and lines on an individual page, save, reload, and confirm the marks remain.
- Confirm Human Verify All includes unsaved formatted edits.
- Confirm combined record, email preview, and shared views show formatting without HTML tags.
- Confirm AI/search receive readable words rather than formatting markup.
- Confirm old plain-text transcriptions still display and edit correctly.
