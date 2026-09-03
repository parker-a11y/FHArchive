# Fix: newly added people missing from record pickers

"J. P. INGLE" was created at 02:13 UTC today and is stored under the same archive owner as every other person, so the database and permissions are fine — the record page simply showed an out-of-date copy of the people list.

## Likely cause (to confirm first)

The person pickers cache the people list in the browser. The Primary Person and Mentions pickers hold that list for 10 minutes and only refresh when a person is created from inside that same picker. A person added on the People page, from AI accept, on another device, or in another tab does not force those pickers to reload, so they keep showing the old list until the cache expires or the page is fully reloaded.

First step is to confirm this in the running app: open a record page, add a person elsewhere, and check whether the picker misses it — and confirm typing "Ingle" finds nothing rather than being a search/matching issue.

## Fix

1. Remove the 10-minute freshness window on the shared people list so pickers always fetch current data on mount.
2. Refetch the people list whenever a picker is opened, so the dropdown is current at the moment of use.
3. Use one shared people-list hook everywhere (Primary Person, From/To, Mentions) so a person added anywhere immediately appears in all of them.
4. If typing an existing name still shows no match, make the "Add ___" path resolve to the existing person rather than offering a duplicate — the fuzzy match dialog already does this; verify it holds for uppercase/punctuated names like "J. P. INGLE".

## Technical notes

- `src/components/PersonCombobox.tsx`: drop `staleTime`, add `refetchOnMount`, and expose the hook as the single source used by `PersonMultiSelect` and `PersonRoleInput` (which currently defines its own duplicate `usePeopleNames`).
- Trigger `refetch()` in each picker's `onOpenChange(true)`.
- Query key stays `["people"]`; the People page query selects extra columns under the same key, so also give the picker hook a distinct key (`["people", "names"]`) and invalidate both keys wherever a person is created, merged, or deleted.
- No migration, no schema change, no change to matching/merge logic.
