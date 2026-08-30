# Auto-link Author / Recipient to People records

## Goal
Turn the FH record **Author (FROM)** and **Recipient (TO)** fields from free-text boxes into people-aware pickers. When a name matches an existing People record (exact, alias, or fuzzy), the record is linked via `letter_people` with role `author` or `recipient`. When there is no match, the user is prompted to create a new People record through the existing confirmation flow. Existing records are backfilled.

## Current state
- `letters.author` and `letters.recipient` are plain text columns.
- `letter_people` is only used for the separate **Mentions** feature (`role = 'mentioned'`).
- Fuzzy matching already exists via `find_person_matches()` and `usePersonMatcher`/`MatchPersonDialog`.
- Merging people already rewrites the free-text `author`/`recipient` strings, but no code auto-creates `letter_people` rows for those fields.

## What will change

### 1. People-aware Author / Recipient inputs
- Replace the plain text Author and Recipient inputs in **Quick Entry** (`src/routes/_authenticated/catalog.tsx`) and the **record detail page** (`src/routes/_authenticated/letters/$archiveId.tsx`) with a reusable people combobox.
- The combobox behaves like the existing people pickers:
  - Search existing People + aliases as the user types.
  - Francis, Fran, Jacquelyn/Jacqueline, and Jaq remain pinned at the top.
  - Exact/strong fuzzy matches are offered for selection or merge.
  - "Create new person" triggers the large confirmation dialog already used elsewhere.
- The free-text `letters.author` / `letters.recipient` columns are kept in sync with the selected canonical name so labels, exports, and search continue to work.

### 2. Save-time linking
- On catalog save and record-detail save, resolve the chosen Author/Recipient name to a `people.id`.
- Upsert one `letter_people` row per field with `role = 'author'` or `role = 'recipient'`, replacing any previous link for that role on the same record.
- If the user clears the field, delete the corresponding `letter_people` link.
- Log these relationship changes in `edit_history`.

### 3. Backfill existing records
- Run a one-time cleanup that iterates existing `letters.author` and `letters.recipient` values.
- For each non-empty value, use `find_person_matches()` to locate or create the matching People record, then insert the appropriate `letter_people` rows.
- Ambiguous matches are skipped rather than guessed; they can be fixed later through the merge UI.

### 4. Search & reporting updates
- Update `search_letters()` so filtering by Author or Recipient also matches records linked through `letter_people` with `author`/`recipient` roles, not just the free-text columns.
- Keep the existing text-based sort/filter columns working.

### 5. UI feedback
- In the record detail page, show Author and Recipient as linked chips (like Mentions) that navigate to the person.
- Add a read-only indicator for guest viewers.

## Out of scope
- Primary Person remains a single-select text field for now; this plan only affects Author and Recipient.
- No schema changes are required beyond adding `letter_people` rows with new role values.

## Verification
- Create a new FH record, type "Fran" in Author, select the existing Francis record, save, and confirm a `letter_people` row with `role = 'author'` exists.
- Type an unknown name in Recipient, confirm the create-person dialog, save, and confirm the new person is created and linked.
- Run the backfill, then verify existing records gain author/recipient links without duplicate people being created.
