# Fix "new row violates row level security policy" on uploads and edits

## What's actually wrong

When guest access was tightened, the old permission rules were removed and replaced with rules that only name the **Archivist** role. Your account is the **Admin/owner**, not an archivist — so on almost every part of the archive, nothing grants you permission to write.

Confirmed by inspecting the live rules:

- Scans, scan files, page transcriptions, edit history, people, places, keywords, events, digital sources, containers, notes and more: the only "allow" rule left names archivists.
- File storage for the `scans` bucket: uploading is allowed for archivists only, so your scan upload is rejected.
- Deleting: on most tables, including records themselves, **no one** can delete right now — which is why removing the duplicate records also has to be done as a permission fix.
- Creating a record now works because that one rule was already repaired earlier — which matches what you saw: the record saved, the scan upload failed.

## The fix

1. Restore full write access for editors (Admin **and** approved Archivist) everywhere in the archive, replacing the archivist-only rules with one consistent rule set covering create, edit, and — for admins — delete.
2. Same for file storage: admins and approved archivists can upload, replace, and delete files in the `scans`, `ds-files`, and `container-photos` buckets.
3. Keep guests strictly read-only: no create, edit, upload, or delete anywhere. Guest reading, search, Ask Francis, On This Date and recaps stay exactly as they are.
4. Delete the two duplicate records FH0048 and FH0049 (both "Letter from Fran to Jaq - 1944-11-07", no scans or people attached), leaving the next number as FH0050.
5. Verify afterwards by listing the resulting rules per table and confirming the admin, archivist, and guest paths each behave as intended.

## Technical detail

- One migration that, for every archive table, drops the leftover `archivists insert/update` and restrictive `editors only ...` policies and creates permissive policies using `can_edit_archive(auth.uid())` for INSERT/UPDATE and `is_admin(auth.uid())` for DELETE, keeping `can_read_archive(auth.uid())` for SELECT.
- Tables covered: letters and all its junction/child tables, digital_files, file_derivatives, scan_transcriptions, edit_history, ai_suggestions, digital_sources and all `ds_*` tables, source_containers, container_files, people, person_aliases, places, organizations, events, keywords, tone_options, record_categories, record_links, historical_references, historical_claims, archive_notes, weekly_recaps, record_shares, source_shares, rejected_entities.
- Counter tables (`archive_counter`, `ds_counter`, `container_counter`) stay locked to their security-definer functions.
- `storage.objects`: replace the archivist-only insert/update policies with `can_edit_archive` ones for the three private buckets; delete stays admin-only.
- Duplicate cleanup happens in the same migration (`DELETE FROM public.letters WHERE archive_id IN ('FH0048','FH0049')`); `archive_counter` is left untouched so numbering keeps moving forward.
