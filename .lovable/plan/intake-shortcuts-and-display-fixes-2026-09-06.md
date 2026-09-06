# Intake shortcuts and display fixes

Seven small changes to speed up cataloging and make envelopes read correctly.

## 1. Identification status defaults to "Identified"
New records start with Identification status set to **Identified** instead of blank. Still changeable from the dropdown.

## 2. Quick Entry remembers the last storage location
When you create a record, the storage type and container/provenance choices you used last are pre-filled on the next new record (remembered in the browser, per person). Folder / jacket keeps defaulting to the new FH number.

## 3. Storage type always assumes File Jacket
If nothing has been remembered yet, Storage type starts on **File Jacket**.

## 4. Label dialog closes after printing
Pressing "Print to label printer" now closes the label window automatically once the print dialog is dismissed.

## 5. Envelopes always shown horizontally
Any scan labeled as an envelope that is stored taller than it is wide is automatically turned a quarter turn for display, so envelopes always appear horizontal in the record view, the Envelope Review page, and the enlarged viewer. The stored file is not changed, and the manual rotate button still works on top of the automatic turn.

## 6. "Ft Schuyler" quick pick for Origin
A second quick button next to "FPO - San Francisco" under Mailing origin, filling in `Ft Schuyler`.

## 7. "NONE" quick pick for Date as written
A small button under Date as written that fills the field with `NONE` for records with no written date. It also sets the date status to Undated so the record is grouped correctly.

## Technical notes

- `src/routes/_authenticated/catalog.tsx`: `blank.identification_status = "identified"`, `storage_type` default `"file_jacket"`; persist `storage_type`, `storage_folder` prefix behavior unchanged, `source_container_id`, `original_order_notes` to `localStorage` on successful save and rehydrate in `loadNext()`; add origin and date quick-pick buttons matching the existing Worcester/FPO button styling.
- `src/routes/_authenticated/letters/$archiveId.tsx`: keep existing behavior; only the intake default changes (no migration, `identification_status` stays text).
- `src/components/letter/LabelDialog.tsx`: `PrintButton` takes an `onDone` callback; call `window.print()` then close the dialog (print is synchronous/blocking in browsers; also listen for `afterprint` as a fallback). Applies to both `LabelDialog` and `EntryLabelDialog`.
- Envelope orientation: add a shared helper (e.g. `autoEnvelopeRotation(file)`) that returns `90` when the file is envelope-labeled and `height > width` using the stored `width`/`height` on `digital_files`, else `0`; add it to the existing `rotation` used when rendering in `envelopes.tsx`, `DigitizationPanel`/file panels, and the lightbox. Purely a display transform — no storage writes, no AI call needed.
