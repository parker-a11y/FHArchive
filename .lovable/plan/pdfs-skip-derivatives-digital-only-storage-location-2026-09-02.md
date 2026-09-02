# PDFs skip derivatives + "Digital Only" storage location

## 1. PDFs are complete on upload

Right now every uploaded master is expected to produce a JPEG viewing copy and a thumbnail. A PDF can't be rendered in the browser, so it stays stuck in "Ready to Confirm" and, on confirm, throws "This file type cannot produce image derivatives".

Change:
- Treat a PDF (and any other non-image master) as **not needing derivatives**. It is counted as processed the moment it is uploaded.
- The confirm step skips those files instead of attempting generation, so no error is recorded and no red "Processing Error" state appears.
- A record whose only masters are PDFs shows **Processing Complete**, not "Ready to Confirm".
- In the file list, a PDF shows a document icon plus an "Open PDF" / download link in place of the missing thumbnail.
- Existing PDFs that already logged a failed derivative are treated as clean once this ships.

Nothing changes for TIFF/JPEG/PNG scans.

## 2. "Digital Only" storage location

Add **Digital Only** as a choice in the physical Storage Type picker (record intake and record editing), described as: item exists only in this archive plus the nightly Google Drive backup — no physical container.

When Digital Only is selected:
- The physical placement fields (folder, position, box/container) are hidden, since there is no shelf location.
- The record detail header shows "Digital Only" where a physical location would normally be shown.

No change to the backup job itself — digital masters and PDFs are already included in the nightly Google Drive mirror.

## Technical notes

- `src/lib/derivatives.ts` `canDerive()` already identifies non-image types; `src/lib/scan-confirm.ts` (`pendingFiles`, `scanStatus`, `generateDerivatives`) will use the same predicate so non-derivable masters are excluded from the pending set.
- `src/components/letter/DigitizationPanel.tsx` confirm loop skips them; `src/lib/digital-files.ts` returns an empty `thumbUrl` with a signed master URL for PDF display.
- `STORAGE_TYPES` in `src/lib/archive.ts` gains `{ value: "digital_only", label: "Digital Only" }`; conditional rendering in `catalog.tsx` and `letters/$archiveId.tsx`. No migration needed — `storage_type` is a free text column.
