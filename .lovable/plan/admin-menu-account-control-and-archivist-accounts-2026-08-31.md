# Admin menu, Account Control, and Archivist accounts

## Goal
Add an owner-only ADMIN menu with an Account Control page, introduce a new ARCHIVIST account level between Guest (view-only) and Admin (you), and let you promote approved guests to Archivist.

## What Archivists can do

Can:
- Send scans for OCR / AI transcription, edit and human-verify transcriptions
- Run AI analysis and accept suggestions
- Edit existing FH records: metadata fields, dates, notes, tones, summaries, research fields
- Add and edit keywords, people, places, organizations, events, and link them to records
- Create, edit and manage Digital Sources and upload source files

Cannot:
- Create new FH records or Quick Entry
- Delete anything (files, records, sources, entities)
- Merge people/places, manage categories, backups, sent email, or user accounts

## Navigation

In the sidebar, directly above Sign out, an **Admin** item appears only for your account (admin role). It expands to a submenu with **Account Control** (`/admin/users`). Guests and Archivists never see it.

## Account Control page

The existing `/admin/users` page becomes Account Control and shows every account with email, name, requested note, status, role and dates. Per account you can:
- Approve or revert a pending guest
- Toggle an **Archivist** checkbox to switch an approved account between Guest and Archivist
- Delete a guest/archivist account (unchanged)
- Your own admin account is listed but not editable

Promoting to Archivist sends the account a notification email ("You now have Archivist access", with a link to the archive) using the existing email templates system. No confirmation click is required — access applies immediately.

## Technical notes

Database migration:
- Add `archivist` to the `app_role` enum
- `is_archivist(uuid)` and `can_edit_archive(uuid)` (admin or approved archivist) security-definer functions; `can_read_archive` extended to include approved archivists
- New RLS policies granting archivists INSERT/UPDATE (no DELETE) on: `letters` (UPDATE only), `scan_transcriptions`, `ai_suggestions`, `file_derivatives`, `keywords`, `letter_keywords`, `people`, `person_aliases`, `places`, `organizations`, `events`, all `letter_*` link tables, `historical_references`, `digital_sources`, `ds_files` and `ds_*` link tables, `record_categories`, `tone_options`
- `digital_files` stays admin-only for INSERT/DELETE (archivists don't upload or delete scans) but archivists may UPDATE rows they transcribe/label
- Because all archive rows are owned by your account, a `BEFORE INSERT` trigger on the archivist-writable tables stamps `owner_id` with the archive owner's id so archivist-created keywords/people/sources stay in your single owner scope and remain visible to existing owner-scoped queries and fuzzy matching
- Storage policies: archivists can read `scans`/`ds-files`/`container-photos` and write `ds-files`; no deletes

App changes:
- `useAuth` gains `isArchivist` and `canEdit` (admin or archivist); `isGuestViewer` stays "approved, non-editing" so existing read-only gating still applies to guests
- Controls currently gated on `isAdmin` are re-classified: transcription/OCR, AI analysis, field editing, keyword/entity add-edit and Digital Source create/edit switch to `canEdit`; delete/merge, Quick Entry, Categories, Work Queues, Backups, Sent Email and Users stay `isAdmin`
- `AdminOnly` route guard applies to Quick Entry, Categories, Queues, Backups, Emails, Admin; Digital Sources `new` becomes editor-accessible
- `profiles.functions.ts` gains `setAccountRole` (admin-only) that swaps the `user_roles` row between `guest` and `archivist` and sends the notification email; new `archivist-granted` email template registered alongside `guest-approved`
