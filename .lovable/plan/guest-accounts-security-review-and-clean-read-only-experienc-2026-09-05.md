# Guest accounts: security review and clean read-only experience

Goal: guarantee a guest can never change anything, remove every control and field they can't use, and give them full use of everything else — search, sorting, Ask Francis, On This Date, weekly recaps (including generating one), record and source browsing.

## What the review found

Checked the database rules, the file-storage rules, and every server action.

Solid today:
- Editing existing archive records, people, places, sources, containers, keywords and links is restricted to the owner/archivist rules — a guest cannot touch them.
- Uploading, replacing or deleting files in the scans, source-file and container-photo areas requires archivist rights.
- Sending archive email, backups review pages, quick entry, categories, envelope review and account control are admin-only screens.

Gaps to close:
1. Leftover per-user rules let any signed-in account (a guest included) create brand-new rows they own — their own letters, people, keywords, sources, notes and so on. These never appear in the shared archive, but they are still writes and should not be possible.
2. The same leftover rules let a signed-in account upload files into their own folder in the scans / source-file / container-photo areas.
3. The "run a backup now" action has no permission check on the server, so a guest could trigger a backup by calling it directly.
4. Weekly recap generation, refinement and emailing are admin-only. You want guests able to generate and view recaps (emailing stays admin).
5. Interface leftovers: several pages still render disabled form fields, empty action columns, tabs and panels that do nothing for a guest.

## Plan

### 1. Lock down writes (database + storage)
- Remove the leftover "anything you own" write rules on archive tables so inserts, updates and deletes require archivist or admin rights; keep read access exactly as it is now.
- Remove the matching per-user upload/update/delete rules on the three private file areas, leaving read for approved accounts and write for archivists only.
- Keep the guest's own profile row writable (needed for sign-up) and nothing else.

### 2. Lock down server actions
- Add an admin check to "run backup now".
- Sweep every server action once more and give each an explicit role check: read actions require archive access, write actions require archivist/admin.

### 3. Open the right features to guests
- Let guests generate an On This Date narrative on demand (already the case) and generate a weekly recap for a week that has none, plus view all recaps.
- Editing, refining, regenerating and emailing recaps stay admin-only.
- Ask Francis, lenses, sharing results by email, search, sorting, filtering, timeline, quotations, and all browse views stay fully available.

### 4. Clean the guest interface
Replace "disabled field" styling with genuinely hidden controls:
- Record page: hide the editing form entirely and show a clean read-only detail view (metadata as labelled text, scans as a viewable gallery, transcription as text). No Save, upload, rename, rotate, transcribe, AI, label-print or delete controls; no empty AI/suggestion panels.
- Digital source page and container page: same read-only treatment.
- People, places, organizations, events, keywords: hide Add / Merge / Delete / Save and the row action column; keep search, sorting and detail pages.
- All Records: remove inline cell editing affordances and any bulk/edit column; keep every filter, health chip, sort and export.
- Dashboard, Ask Francis, recaps, On This Date, quotations: hide only the admin-only buttons (refresh snapshot, edit, regenerate, review status, send email), keep everything else.
- Sidebar: continue hiding write/admin destinations, and confirm no guest-visible page links to a hidden one.

### 5. Verify
- Re-run the database security check.
- Sign in as a guest in a browser session and walk the whole app: confirm no editing control appears, that the read-only views show the full catalog information, and that Ask Francis, search, On This Date and recap generation work.
- Attempt a direct write as a guest (create a record, upload a file, trigger a backup) and confirm each is refused.

## Technical notes
- Migration drops the `own <table>` policies on archive tables and the `own scan files`, `own container photo objects`, `Owners * ds-files objects` storage policies; archivist/admin policies already cover legitimate writes.
- `AdminOnly` / `EditorOnly` wrappers stay; the record page grows a `ReadOnlyRecordView` path rather than `<fieldset disabled>`.
- Recap generation gains a `can_read_archive` check in place of `assertAdmin` for the generate path only.
