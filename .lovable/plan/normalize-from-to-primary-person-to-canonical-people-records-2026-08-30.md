# Normalize FROM / TO / Primary Person to canonical People records

Right now the same person appears under several spellings in record fields:

| Record | From | To | Primary Person |
|---|---|---|---|
| FH0001 | Francis A. Harrington | Friends of MPA | — |
| FH0005 | — | — | Jaq |
| FH0008 / FH0009 | Fran | Jaq | Jaq |
| FH0010 | — | — | Jacqueline Harrington |
| FH0011 | Fran | Jaq | Jacqueline Harrington |

Also, the alias "Mrs. J. A. Harrington" is currently attached to Francis A. Harrington, which is wrong — it belongs to Jaquelyn.

## What will change

1. **Canonical people**
   - `Francis A. Harrington` stays the master record for Fran / Francis / F A Harrington variants.
   - `Jaquelyn Harrington` becomes the master record for Jaq / Jacqueline Harrington / Mrs. F A Harrington variants.

2. **Alias cleanup**
   - Move `Mrs. J. A. Harrington` off Francis and onto Jaquelyn.
   - Add to Jaquelyn: `Jaq`, `Jacqueline`, `Jacquelyn`, `Jackie`, `Mrs. F. A. Harrington`, `Mrs. Francis Harrington`, `Mrs. Harrington`.
   - Add to Francis: `Frank`, `F. A. Harrington`, `Lt. F. A. Harrington` (keeps the existing Fran/Francis aliases).
   - Existing alias `Jacqueline Harrington` on Jaquelyn stays.

3. **Scrub every record**
   - `author`, `recipient`, and `primary_person` text on all FH records is rewritten to the canonical name whenever the current value matches a person name or one of that person's aliases. `Fran` → `Francis A. Harrington`, `Jaq` / `Jacqueline Harrington` → `Jaquelyn Harrington`.
   - Same scrub applied to Digital Sources creator fields where the value matches an alias.

4. **Structured links**
   - After the text scrub, author/recipient people links are re-backfilled so every rewritten record also has a proper `letter_people` link (this previously failed for `Jaq`).

5. **Keep going forward**
   - Primary Person picker will store the canonical person name only, matching the Author/Recipient pickers, so new entries can't reintroduce nicknames.

## Left alone

`Friends of MPA` is a group, not a person, so FH0001's recipient stays as written and is not linked to a People record.

## Technical notes

- Alias moves/additions and the text rewrite run as data updates against `people`, `person_aliases`, `letters`, and `digital_sources`; matching is case- and punctuation-insensitive using the existing `alias_norm` normalization.
- Recipient/author link backfill reuses the existing exact-name-or-alias matching logic, now succeeding for the newly added aliases.
- Primary Person UI change is a swap to the existing `PersonRoleInput` component in `catalog.tsx` and `letters/$archiveId.tsx`; the column stays text.
