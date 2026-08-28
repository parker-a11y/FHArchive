# Fix: Digital Source file uploads silently failing

## What's happening

Nothing uploaded for DS-0002. The stored-files table has 0 rows and the `ds-files` bucket has 0 objects, so the upload was rejected — but the panel still showed "Preservation copies uploaded".

Cause: the storage access rules for the `ds-files` bucket require the first folder of the file path to be your user ID. The upload code builds the path as `DS-0002/<timestamp>-<filename>` instead, so every upload is rejected. The red error toast appeared behind the success toast because the success message is shown unconditionally at the end, even when every file failed.

## The fix

1. Upload to `<user id>/<DS id>/<timestamp>-<filename>` so the path matches the access rules.
2. Track successes and failures during the upload loop:
   - all succeeded → "Preservation copies uploaded"
   - some failed → warning naming how many failed
   - all failed → error only, no success toast
3. Surface the real error text from storage in the toast, so future failures are readable rather than hidden.

## Technical notes

- File touched: `src/components/sources/DsFilesPanel.tsx` (path construction in `upload()`, toast logic).
- No database or policy changes needed — the rules are correct, the path was wrong.
- No existing files need migrating (zero rows stored).
- Downloads, previews and delete already use the stored `storage_path`, so they keep working with the new layout.
