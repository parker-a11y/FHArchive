# Add a "Mentions" field to FH Records

Primary Person stays exactly as it is (single main subject). A new **Mentions** field lets you list everyone else a record mentions.

## What you get

- A **Mentions** field directly under Primary Person, on both Quick Entry and the record detail page.
- Pull-down list of every person already in the People database, with type-to-search.
- Multiple people can be added; each shows as a removable chip.
- If a name isn't in People yet, you can add it inline from the same pull-down. It runs through the existing duplicate/fuzzy match check and the large "confirm new person" dialog, so no accidental duplicate person records.
- Mentions are saved as person links on the record (role: mentioned), so they already show up in the record's People panel, on the person's page under "Letters mentioning", and in search — no new tables or schema changes.

## Behavior details

- Deduplicated: selecting someone already linked as a mention does nothing.
- Removing a chip removes that mention link only; it never deletes the person record, and it does not touch author/recipient/subject links.
- On Quick Entry, mentions selected before saving are attached right after the record is created.
- On the record detail page, adding or removing a mention saves immediately and refreshes the People panel.

## Technical notes

- New `src/components/PersonMultiSelect.tsx`, modeled on `PersonCombobox.tsx`: same `usePeopleNames` query, same `usePersonMatcher` inline-create path, but value is a list of `{ id, name }`.
- `src/routes/catalog.tsx`: hold pending mentions in form state; after the `create_record` RPC returns the new letter id, insert `letter_people` rows with `role: "mentioned"`, `source: "manual"`.
- `src/routes/letters/$archiveId.tsx`: render the field next to `primary_person`; read existing `letter_people` rows with role `mentioned` and write inserts/deletes directly, invalidating the record and People-panel queries.
- No migration required — `letter_people` already supports the `mentioned` role and is used by AI analysis and the Research panel.
