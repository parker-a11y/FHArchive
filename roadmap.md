# Roadmap

- [x] Add the collapsible Cast of Characters & Setting panel above letter tabs; shared-letter counts tested and signed-in FH0647 expanded/collapsed with shared links verified on desktop and mobile.

- [x] Add a minor-edit confirmation to retain completed AI review without rerunning analysis; four regression tests passed and signed-in confirmation persisted after reload on FH0011.

- [x] Correct prior-send history for sources and older emails with paginated reads, retained structured membership, and an unknown indicator where legacy DS history was lost.
- [x] Isolate recovery by saved draft and originating composer; regression tests and signed-in reload/save/reopen checks passed without sending email.

- [x] Add a Storage Boxes summary with record counts and expandable contents grouped by current storage location (587 records verified, search and record links tested).

- [x] Add admin-only blank SEND EMAIL actions to Email Admin and Weekly Recaps, with uploaded file links preserved in drafts, scheduling, and shared emails.

- [x] Join continuing sentences at transcription page boundaries without changing individual page reviews (13 tests passed; verified combined display on FH0559).
- [x] Restore authenticated daily backups and verify a fresh catalog dump and resumed Google Drive file copying.
- [x] Publish backup reliability changes so nightly file copying uses bounded, resumable batches (published Oct 20, 2026).
- [x] Catch-up copying of scan files to Google Drive: scans bucket 8,410 files, 8,431 backed-up rows, only today's just-uploaded photos pending the next 10-minute tick; temporary `backup-catchup-15min` schedule can now be deleted
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

- [x] Simplify photo intake: front + optional back image, writing on back, title, date, people, place, box
- [x] Bulk Photo Upload: drag photos into an Unassigned bucket, then pick photos there to create records

## Photo Archive, Organizer, Gallery & Photo Storage
- [x] Stage A — permanent PH numbers (PH00001…), counter + safe assignment on upload, admin-approved backfill of the 53 existing photos, legacy FH photo links resolve to the photo
- [x] Stage B — optional details (people, date as written + sortable years, location, verbatim inscription, information source, back transcription) and category list/manager seeded with the 12 starting categories
- [x] Stage C — batch uploader with live counts, failed-only retry without duplicates, named upload batches (real multi-file drag-and-drop upload verified: each file took the next PH number)
- [x] Stage D — admin Photo Organizer: large photo, category buttons, working sets (uncategorized/all/recent/batch/category), keyboard nav, autosave details, new-category creation
- [x] Stage E — Photo Record List with search/sort, checkbox + shift-range + select-all, bulk category and box actions; PHOTO-### boxes with contents and printable labels on Storage Boxes
- [x] Stage F — "The Photo Archive" gallery: justified lazy-loaded grid, category and search filtering, immersive viewer with zoom/fullscreen/keyboard, stable PH links, guest downloads limited to viewing JPEGs
- [x] Photo connections: link a photo to letters, other photos or people with certainty and a note; shown in the viewer and as a linked-photographs strip on the letter page
- [ ] Printable PHOTO box labels — printed from Storage Boxes and checked

## Book Builder
- [x] Phase 1 — core Book Builder (projects, record selection, ordering, letter → envelope → transcription layout, preview, background PDF export, print copies, source-change checks)
- [x] Phase 2 — custom page builder (templates, drag/resize editor, archive/gallery images, essay pagination)
- [x] Phase 3 — advanced publishing and Blurb/Lulu/BookBaby profiles

- [x] Book Builder Phase 3: chapters, contents, front matter, themes, facing pages, Lulu/Blurb/BookBaby profiles, preflight, cover designer (23 tests; real 156-page Lulu test book + cover exported and checked)
