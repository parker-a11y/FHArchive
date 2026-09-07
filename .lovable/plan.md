# Full scan tools on the Catalog page

The scan area on Catalog is currently a simple queue: pick files, type a name, save. It should behave exactly like the scan area on a record page — thumbnails, naming, rotation, the mini viewer, and "mark upload complete".

## How it will work

1. At the top of Quick Entry, next to the FH number, a **Start record** button.
2. Clicking it creates the record straight away with what's filled in so far (record type, subtype, remembered storage settings). The FH number is now claimed.
3. The full scan panel — the same one used on the record page — appears in place of the simple file list. From there you can:
   - drop or pick multiple files, see thumbnails appear as they upload
   - name each scan (with the suggested labels), reorder, rotate, delete
   - open the mini viewer with zoom and rotate
   - see the scan status and press the confirm/"mark upload complete" step that generates the viewing copies
4. You keep filling in the rest of the form as normal. **Save** updates the record that already exists instead of creating a second one, and **Save & open record** takes you to it.
5. If you never click Start record, nothing changes: the page works exactly as it does today, minus the simple queue, and scans are added on the record page after saving.

Leaving the page after Start record leaves a thin record behind — the same as any record saved early. The FH number is used, which is why it's a deliberate button press.

## Technical notes

- `src/routes/_authenticated/catalog.tsx`:
  - New state `startedLetter: Letter | null`. `handleStart()` calls the existing `createRecord` with the current form values (same payload builder as save, factored into a helper so both paths share it), then stores the returned row.
  - Remove the local `ScanItem` queue, `toScanItems`, the dropzone JSX, and the post-create `uploadScanMaster` loop. Keep the follow-up `extras`/warning behaviour.
  - When `startedLetter` is set, render `<DigitizationPanel letter={startedLetter} />` in the scan slot; it already owns thumbnails, naming, rotation, `MediaLightbox`, and confirm/derivative generation.
  - Save path branches: if `startedLetter` exists, `supabase.from("letters").update(...)` on its id and reuse the existing extras/link logic; otherwise the current `createRecord` path. `loadNext()` clears `startedLetter` after a save.
  - `DigitizationPanel` reads `letter.record_type`, `sheets`, `has_envelope` etc. for expected-scan hints; refresh its `letter` prop from the form values on save so hints stay accurate (pass a merged object rather than the stale created row).
- No schema change, no migration. `uploadScanMaster` in `src/lib/scan-confirm.ts` stays as the shared uploader.
