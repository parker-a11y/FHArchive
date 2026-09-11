# Dashboard "Update Status" button

Add a button on the Dashboard that re-checks every record's real state and corrects any status fields that have drifted, then refreshes the colored dots everywhere.

## What the button does

For every FH record, it compares the stored status against what is actually in the archive and fixes mismatches:

- **Scan status** — if the record has scan files but is still marked "not scanned", set it to scanned; if it has no files, mark it not scanned.
- **Transcription status** — if every page transcription is human checked, set the record to human verified; if there is transcription text but none verified, set it to AI transcribed; if there are scans but no transcription at all, set it back to pending. Records marked "not required" are left alone.
- Records with no changes are skipped.

When it finishes, it shows a short summary ("Checked 92 records, updated 4") and reloads the dashboard counts and recent list so the dots are immediately correct.

## Also fixed

The Dashboard's "Recently entered" list currently draws its dot without checking AI-analysis state, so a fully finished record can show purple there while All Records shows green. The list will load the same AI state All Records uses, so the colors match.

## Technical details

- New `src/lib/record-status.functions.ts`: `recomputeRecordStatuses` server function, `.middleware([requireSupabaseAuth])`, admin/editor only. Pages through `letters`, joins `digital_files` and `scan_transcriptions` counts, batches updates, returns `{ checked, updated }`.
- Status precedence mirrors `src/lib/record-health.ts` so table dots, dashboard dots and the `search_letters` health filter agree.
- Dashboard (`src/routes/_authenticated/index.tsx`): button in the page header actions (hidden for guests), `useServerFn` + loading state, sonner toast on completion, then invalidate `dashboard-stats`, `dashboard-recent`, `letters` queries.
- Recent list gains an `ai_suggestions` count query keyed by the 10 visible letter ids, passed as the second argument to `recordHealth`.
