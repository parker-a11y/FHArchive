# Catch up scan backups to Google Drive now

## Goal
Copy the remaining scans to the "The Francis Files Backups" Drive folder today, rather than over several nights.

## Steps
1. Check how many scans are still missing from the Drive backup index.
2. Run the existing backup file copy in small, paced batches (one at a time, short pauses), using the resume-from-index logic so nothing is copied twice.
3. If Drive pushes back with a connection limit, wait and retry that batch instead of rushing ahead.
4. Stop once the missing count reaches zero, or after a safe number of batches if Drive keeps refusing, and report what remains.
5. Confirm the counts in Drive match the archive, and that tonight's scheduled backup still runs.

## Technical details
- Uses the existing bounded per-run mirroring and retry helpers in the backup module; no new code expected.
- Batches are triggered through the backup endpoint with the cron authenticator, sequentially.
