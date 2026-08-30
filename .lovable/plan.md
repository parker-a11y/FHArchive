Remove redundant scan-status dashboard tiles

Goal
Clean up the dashboard by removing tiles that duplicate the FH records count.

Changes
- In `src/routes/index.tsx`, remove the "Records scanned" stat tile.
- In `src/routes/index.tsx`, remove the "Records missing scans" stat tile.
- Keep "FH records" (total saved records) and "Total scans" (total scan file count).
- Remove any now-unused icon imports if they become orphaned.

Rationale
The user confirmed that every FH record in this collection will be scanned, so "Records scanned" always equals "FH records" and "Records missing scans" is always zero. Removing them eliminates redundant dashboard noise.

Verification
- Build passes after the edit.
