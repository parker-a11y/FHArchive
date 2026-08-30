# Stop duplicate people (and clean up the existing ones)

Right now the archive has these people records, and several are the same person:

- Francis A. Harrington, FRANCIS HARRINGTON, HARRINGTON F A, Francis
- Jacqueline Harrington, Mrs. Harrington
- E. B. Bell, Emile F. Coulon, Miller B. Colton, Queen Victoria, Tuan Hakim (all fine)

The cause: when an AI suggestion is accepted, the app only looks for an exact (case-insensitive) name match. Anything spelled differently becomes a brand-new person.

## What gets built

### 1. Aliases on each person
Each person gets a list of alternate names ("Fran Harrington", "FA Harrington", "Mrs. Harrington"). Names already stored in the free-text `alternate_names` field are carried over. Matching then checks the canonical name *and* every alias, ignoring case, punctuation, and initials formatting.

### 2. Fuzzy "Match to record" pop-up
When accepting an AI suggestion (or typing a new name in the person picker), if the name isn't an exact/alias hit but is close to an existing person, a dialog appears:

```text
"FA Harrington" looks like someone already in the archive.

  ( ) Francis A. Harrington        92% match
  ( ) Francis                      71% match
  ( ) Create a new person "FA Harrington"

  [x] Remember "FA Harrington" as an alias of the selected person
```

Choosing an existing person links the record to that person and (if checked) saves the spelling as an alias, so the same variant is matched automatically forever after. Nothing is auto-merged without a click.

### 3. Duplicate cleanup tool on the People page
A "Find duplicates" view groups likely-same people by name similarity and lets you merge a group into one chosen canonical person. Merging:
- re-points every record link (letters, digital sources, roles) to the surviving person
- keeps the merged names as aliases
- deletes the emptied duplicate rows
- logs the merge in edit history

### 4. First cleanup pass
The tool will be pre-loaded with the two obvious groups found above so you can confirm them in a couple of clicks:
- Francis A. Harrington ← FRANCIS HARRINGTON, HARRINGTON F A, Francis
- Jacqueline Harrington ← Mrs. Harrington

"Francis" is ambiguous on its own, so it is presented as a suggestion to confirm, not merged automatically.

## Technical notes

- Migration: `person_aliases` table (owner-scoped, unique normalized alias, GRANTs + RLS matching existing people policies); enable `pg_trgm`; a `find_person_matches(name)` security-definer function returning candidates ranked by trigram similarity over names + aliases; a `merge_people(target_id, source_ids[])` function that re-points `letter_people`, `ds_people`, and any `letters.author/recipient/primary_person` text fields, copies names into aliases, deletes sources, and writes edit-history rows.
- `src/lib/ai-analysis.ts` `findOrCreate` for people: exact → alias → fuzzy candidates; when fuzzy hits, defer to the new dialog instead of inserting.
- New `MatchPersonDialog` component used by both the AI accept flow (`ResearchPanels.tsx`) and `PersonCombobox.tsx`.
- New "Duplicates" tab on `/people` calling the match/merge functions.
- Same alias/fuzzy approach could later apply to places and organizations; this plan covers people only.
