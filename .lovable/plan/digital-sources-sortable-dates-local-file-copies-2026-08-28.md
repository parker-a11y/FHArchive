# Digital Sources: sortable dates + local file copies

Two related changes to the Digital Sources (DS) side of the archive. DS records stay DS records — nothing here creates FH numbers.

## 1. Sortable dates

Keep **Original date (as shown)** free-form for display, and add a separate machine-readable date so sources can be sorted chronologically later.

### Database
- Add `normalized_date` (date, nullable) and `date_precision` (text, default `unknown`) to `digital_sources`.
- Update `create_digital_source(...)` to accept and store both.

### App
- Add the two fields to the Add Source form (`src/routes/sources/new.tsx`): a date input plus a precision select reusing the existing `DATE_PRECISION` options (exact, month, year, approximate, range, undated, unknown).
- Update `DigitalSource` / `NewSourceInput` types and `createDigitalSource` in `src/lib/sources.ts`.
- Sort the sources list by normalized date (undated last), still showing the free-form original date; show both on the DS detail page.

## 2. Preservation copies (file uploads on DS records)

So an online video still, PDF, image, or audio file survives if the original URL goes offline.

### Storage & database
- New private storage bucket `ds-files` with owner-scoped access rules.
- New `ds_files` table: source_id, storage_path, original_filename, file_label, file_type (image / audio / video / document / other), file_size, sort_order, notes. Owner-scoped access only.
- This replaces the unused single `local_file_path` column with support for unlimited files per source.

### App
- New **Files** panel on the DS detail page (`src/routes/sources/$dsId.tsx`, panel in `src/components/sources/SourcePanels.tsx`):
  - Drag-and-drop / multi-file upload.
  - Thumbnail preview for images, inline `<audio>` player for audio, inline `<video>` for video, download link for PDFs and everything else.
  - Editable label + notes per file, delete with confirmation, reorder.
  - Files are served through short-lived signed URLs since the bucket is private.
- Show a file count badge on the DS list page so it's obvious which sources have preservation copies.
- Add a "Files" / "Has preservation copy" stat to the Digital Sources area of the Dashboard.

## Notes
- Downloading the file from the source URL is done by you in the browser, then uploaded here — the app does not fetch remote URLs server-side (many sites block that, and YouTube can't be downloaded directly).
- `rights_notes` already exists on DS records; the Files panel will surface it as a reminder for copyright-sensitive material.
