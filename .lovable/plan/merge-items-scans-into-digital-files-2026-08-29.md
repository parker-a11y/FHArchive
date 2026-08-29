# Merge "Items & Scans" into "Digital Files"

You're right — the two tabs do the same job. **Digital Files** is the newer system: it drives AI transcription, public sharing, automatic JPEG/thumbnail viewing copies, filename identification and the confirm-upload step. **Items & Scans** is the earlier version and only stores a flat image plus a rotation.

Plan: keep Digital Files, retire Items & Scans, and carry the two existing old scans over so nothing is lost.

## What changes on the record page

- The tab list becomes: Catalog · **Scans & Files** · Transcription · People/Places/Keywords · Research · Related · AI Analysis · History.
- "Items & Scans" is gone. The Digital Files tab is renamed **Scans & Files** and shows the scan count in its label, the way the old tab did.
- Everything you already do in Digital Files stays exactly as-is: bulk upload of masters, optional naming, confirm-upload-complete, derivative generation, gallery reorder, transcription, sharing.

## What happens to the existing scans

The 2 scans currently in the old system get copied into Digital Files as master files (their stored image files are reused in place, not re-uploaded), keeping their order, label and rotation. Viewing copies and thumbnails can then be generated for them with the normal Confirm/Generate button. The old scan rows are removed afterwards.

## Notes

- The "pieces within one record" grouping (invitation + program + photo as separate child items) disappears with this change. There are currently no such items in the archive, so nothing is lost. If you want that back later, it can be added as an optional grouping field inside Digital Files.
- Record-level scan counts on the Dashboard and lists switch to counting Digital Files, so the numbers stay accurate.

## Technical details

- Remove `ItemsPanel` and `ScansPanel` components and the `scans` tab from `src/routes/letters/$archiveId.tsx`; rename the `digitization` tab label.
- Data migration (one-off): insert a `digital_files` row per `letter_scans` row reusing `storage_path` as `master_path`, mapping `file_label` → `label`, `sort_order`, `rotation`, `original_filename`; then delete `letter_scans` / `letter_items` rows. Tables `letter_items` and `letter_scans` are dropped in the same migration.
- Update `src/lib/queries.ts`, `src/lib/backup.server.ts` and `src/lib/shares.functions.ts` to stop referencing the dropped tables; public share pages already prefer derivative images from `digital_files`.
- Update `letters.image_count` sync so it counts `digital_files` (currently written by `ScansPanel.syncCount`); move that logic into the digitization panel.
- Dashboard "total scans / items scanned" counters repointed to `digital_files`.
