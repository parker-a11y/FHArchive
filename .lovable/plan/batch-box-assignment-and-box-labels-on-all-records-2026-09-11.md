# Batch box assignment and box labels on All Records

Let a range of records be selected on the All Records page, assign them all to a storage box in one step, and print a matching 4 × 6 box label.

## Range selection

- New "Select range" controls above the table: a From and a To record number (e.g. FH0050 → FH0075). Selecting adds every record in that number range, across pages, not just the ones currently visible.
- Shift-click also works: click one row's checkbox, shift-click another, and everything between them on the page is selected.
- Existing single checkboxes, "Email selected", and "Transcribe selected" keep working exactly as they do now.

## Assign a box

- With records selected, a new "Assign to box" button opens a small dialog.
- Type the box name, or pick one already used in the archive (suggestions come from existing storage locations).
- Only records stored in a File Jacket get updated. Photographs, digital-only items, sleeves, and anything else in the range are skipped.
- Before applying, the dialog shows: how many will be updated, how many are skipped, and the record numbers being skipped.
- After applying, a confirmation states how many records were assigned, and the table refreshes.

## Box label

- A "Print box label" button next to the assign action, and inside the dialog after assigning.
- Same 4 × 6 stock and printing behaviour as the folder label (same print portal, closes after printing).
- Label content:
  - The Francis Files logo
  - Box name, large and prominent
  - The file-jacket record ranges it contains, condensed (e.g. FH0050–FH0058, FH0061, FH0063–FH0075)
  - Record count
  - Date printed
- Box name and the ranges line can be edited in the dialog before printing.

## Technical notes

- Files: `src/routes/_authenticated/letters/index.tsx` (range controls, shift-click, toolbar actions), a new `src/components/letter/BoxLabelDialog.tsx` (assign + label card, reusing the `LabelCard`/print-portal pattern from `LabelDialog.tsx`), and a small helper for range parsing/condensing.
- Box name writes to `letters.storage_location`; eligibility filters on `storage_type = 'file_jacket'`. Updates go through a batched `.in('id', …)` update in chunks, admin/editor only, no schema change.
- Range selection fetches the matching rows by `fh_seq` between the parsed From/To values so cross-page ranges resolve correctly.
- Logo: `src/assets/francis-files-logo.png`, imported directly.

## Verify

Assign a range spanning both pages, confirm non-jacket records are skipped and listed, confirm the storage location column updates, and print a label preview showing correct condensed ranges.
