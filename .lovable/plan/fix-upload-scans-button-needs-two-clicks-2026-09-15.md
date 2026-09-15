# Fix: Upload Scans button needs two clicks

## What's happening

The "Upload Scans / Digital Files" button on a record's Scans & Files page is built as a styled `<label>` wrapped around a hidden file picker. The first click on that label is getting swallowed (it only shifts focus/layout slightly) and the file chooser doesn't open until the second click. This is a known fragile pattern — clicking text near the edge, or any re-render between press and release, breaks the label-to-input handoff.

## The fix

Replace the label-wraps-hidden-input trick with a direct, reliable approach in `src/components/letter/DigitizationPanel.tsx` (around line 836–874):

- A real button you click.
- The hidden file picker kept separately and opened directly by the button's click — no label indirection.
- Same styling, same accepted file types, same multi-select, same drop-zone behavior — nothing else on the page changes.
- Also clear the picker's remembered selection after each use, so uploading the same file twice in a row still works.

## Scope

- Only the Scans & Files upload button (the one reported). The similar pickers on Digital Sources and Photo Intake use the same pattern and can be switched later if they show the same symptom — left untouched to keep this change minimal.

## Verify

- Typecheck passes, preview build OK.
- Browser check on a record's Scans & Files tab: single click opens the file chooser.
