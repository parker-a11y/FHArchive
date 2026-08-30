Remove redundant dashboard tile

Goal
Eliminate the duplicate "records with scans" metric on the dashboard.

Change
- In `src/routes/index.tsx`, remove the "Records with scans" stat tile.
- Keep "Total scans" (file count) and "Records scanned" (distinct records with files from `digital_files`).
- "Records with scans" is derived from `letters.image_count`, which can drift from the actual `digital_files` table; "Records scanned" is the more reliable source-of-truth count.

Verification
- Build passes after the edit.
