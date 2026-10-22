# Roadmap

- [ ] Join continuing sentences at transcription page boundaries without changing individual page reviews.
- [x] Restore authenticated daily backups and verify a fresh catalog dump and resumed Google Drive file copying.
- [x] Publish backup reliability changes so nightly file copying uses bounded, resumable batches (published Oct 20, 2026).
- [ ] Catch-up copying of ~5,400 remaining scans: temporary `backup-catchup-15min` schedule (every 10 min, files-only mode) is running; delete it once `backup_files` count reaches the storage total (~5,733 files).
- [x] Create Short Title uses "Postcard from …" for the Postcard subtype (Quick Entry + record page)

- [x] Remove Container / Box field from UI/exports (DB column kept, unused)
- [x] Original order / position notes: empty default, helper text removed

- [x] Ship USS Doyle C. Barnes logo (sign-in, dashboard, sidebar, favicon) with "The Francis Files" wordmark
- [x] Sign-in page: large logo on left, sign-in tools on right
- [x] Drag-and-drop bulk scan uploads with automatic page ordering
- [x] Dashboard: Daily Summary is one top-section "New today" tile (FH + digital sources); click expands breakdown
- [x] Dashboard: larger Francis Files logo in header
- [x] Dashboard: move All categories tile to last; improve tile text spacing on small screens

- [x] Universal Related Records / cross-references (any record ↔ any record, bidirectional, optional note)

- [x] Weekly Francis Files Recap: Sunday 2AM auto-generation, admin "Generate now"/regenerate/edit/publish, archived at /recaps with linked FH/DS records

- [x] PDF masters: render each page to viewing JPEG + thumbnail (web viewable, AI transcribable), with Render/Re-render pages button
- [x] Tech debt: drop duplicate Postgres indexes on junction tables
- [x] Tech debt: gitignore .env, add .env.example placeholders
- [x] Tech debt: document storage buckets (scans, ds-files) in AGENTS.md

- [x] "What was happening this day" backfill: hourly job writes 3 archive dates/run, queue + pause/resume + retry on the On This Date Review page (publish required for the live cron route)
- [x] Automatically format complete quoted paragraphs when pasted into writing editors
- [x] Restrict backup history and file listings to archive editors
- [x] Money amounts highlight and convert inside formatted transcriptions
- [x] Ask Francis history: "Get public link" button for sharing an answer
