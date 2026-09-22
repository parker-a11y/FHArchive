# Automatic quote formatting when pasting

## What will change
- Detect complete pasted paragraphs enclosed in straight or curly quotation marks.
- Insert those paragraphs as quotation blocks automatically in the shared writing editor.
- Preserve ordinary paragraphs as normal text and keep the existing manual quotation button available.
- Apply this everywhere the shared editor is used, including archive emails and recap/custom-summary editing.

## Technical details
- Add a small, testable plain-text paste formatter to the rich-text utilities.
- Let the shared editor intercept plain-text paste only when at least one complete quoted paragraph is detected; otherwise retain the editor's normal paste behavior.
- Sanitize the inserted result through the existing rich-text allow-list.
- Add focused tests for curly quotes, straight quotes, mixed prose and quotes, and non-quote text.

## Verification
- Run the focused formatting tests.
- Verify pasted mixed prose and quoted paragraphs in the live editor, including the resulting visual quotation blocks.
