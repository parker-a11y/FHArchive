# Better nightly backup strategy

## Goal
Replace the current "full database JSON + ever-growing file mirror every night" backup with a compressed, rotated strategy that keeps recent daily copies, monthly snapshots, and yearly snapshots forever, while leaving the incremental file mirror unchanged.

## Current problem
- The entire database is exported to one uncompresssed JSON file every night.
- Old database dumps are never deleted, so the Drive folder grows by the full catalog size every day.
- Storage files are already mirrored incrementally (only new/missing files are uploaded), which is good, but there is no retention policy for database dumps.

## Proposed strategy
Keep the existing Google Drive destination (`The Francis Files Backups`) and the existing incremental file mirror, but change how database dumps are produced and retained.

1. **Compress each database dump** with gzip before uploading. A compressed JSON dump is typically 80–90 % smaller.
2. **Apply a grandfather-father-son retention schedule** to database dumps only:
   - Keep the last 30 daily dumps.
   - Keep one dump per month for the last 12 months.
   - Keep one dump per year forever.
   - Always preserve the most recent successful dump regardless of age.
3. **Name dumps consistently** so retention rules can identify them by date, e.g. `harrington-archive-YYYY-MM-DD-HH-MM-SS.json.gz`.
4. **Leave the storage-file mirror as-is** — it is already incremental and should not be pruned, because those are the off-site copies of the archive masters.
5. **Add a monthly verification pass** that compares the `backup_files` index against Drive to detect missing or orphaned files.

## User-facing result
- Google Drive stops growing by the full catalog size every day.
- You still have a recent daily copy, plus long-term monthly and yearly restore points.
- File backups remain complete and off-site.
- The backup status page shows retention actions and storage saved.

## Technical implementation

### Files to change
- `src/lib/backup.server.ts` — compress dumps, implement retention rules, add verification pass.
- `src/lib/backup.functions.ts` — no change needed (admin trigger stays the same).
- `src/routes/api/public/backup.ts` — no change needed (cron endpoint stays the same).
- `src/routes/_authenticated/backups.tsx` — add a "Retention" summary card and a "Storage saved" metric.
- Database migration — add optional columns to `backup_runs` for `retention_deleted_count`, `compressed_bytes`, `compression_ratio`.

### Detailed changes
1. **Compression**
   - After building the JSON dump, gzip it in memory (or stream it) and upload as `harrington-archive-{stamp}.json.gz` with `Content-Encoding: gzip` or the appropriate Drive MIME type.
   - Store both uncompressed and compressed byte counts in `backup_runs`.

2. **Retention schedule**
   - After a successful dump upload, list files in the Drive root folder whose names match `harrington-archive-*.json.gz`.
   - Parse the timestamp from each filename.
   - Mark files to keep:
     - The most recent successful dump.
     - One dump for each day in the last 30 days.
     - One dump for each month in the last 12 months (keep the first dump of that month, or the most recent).
     - One dump for each year (keep the first dump of that year, or the most recent).
   - Delete all other matching files from Drive and log the count in `backup_runs`.

3. **Safety rules**
   - Never delete the only remaining dump.
   - Never delete a dump younger than 48 hours unless it is explicitly outside the retention window.
   - Stop retention deletion if listing Drive files fails, to avoid accidental mass deletion.

4. **Monthly verification**
   - On the first backup of each calendar month, run a lightweight verification:
     - List all rows in `backup_files`.
     - For a random sample (e.g. 10 %) or all files, confirm the Drive file ID still exists.
     - Report missing files in the backup run row.

5. **Backup status page updates**
   - Show "Retention policy: 30 dailies + 12 monthlies + yearly forever".
   - Show estimated storage saved by compression and rotation.
   - Show last verification result.

## Risks and mitigations
| Risk | Mitigation |
|------|------------|
| Accidental deletion of all dumps | Keep the most recent dump regardless of age; abort if Drive listing fails. |
| Compression makes restore harder | Add a one-click "Download latest dump" button and document unzipping with standard tools. |
| Retention deletes a wanted old dump | Monthly/yearly snapshots are explicitly preserved; yearly snapshots are kept forever. |

## Success criteria
- New backups upload a `.json.gz` file instead of a raw `.json` file.
- After 35 days, only ~30 daily + 1 monthly dump remain in Drive (not 35 dumps).
- The backup status page shows the retention policy and compressed size.
- Existing file mirror continues incrementally without change.
