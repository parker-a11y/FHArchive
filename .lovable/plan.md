# Add a new Primary person while creating an FH record

Today "Primary person" on the Quick Entry form is a fixed dropdown with four hardcoded choices (Francis, Jacqueline, Francis & Jacqueline, Other) and it saves as plain text on the record. It is not connected to your People page, so there is no way to add someone new during entry.

## What changes

- Replace the fixed dropdown with a searchable picker that lists:
  - the built-in options (Francis, Jacqueline, Francis & Jacqueline), plus
  - every person from your People records, alphabetically.
- Type a name that doesn't exist and an "Add ___ as a new person" option appears at the top of the list. Choosing it creates the person record immediately and selects them as the primary person for the record being cataloged.
- The new person appears everywhere else people appear (People page, the Research tab's people links, counts) with no extra step.
- The same picker is used on the FH record detail page so you can also change/add a primary person after the fact.

## Notes

- The record still stores the primary person as a name (text), so existing records and the table/search/export views keep working unchanged. No database migration is needed.
- Newly created people start with just a name; you can fill in dates, relationship, and biographical notes later on their person page.
- Free typing without saving is still allowed for one-off names — you'll only create a People record if you pick the "Add as new person" option.

## Technical outline

- New `src/components/PersonCombobox.tsx` built on the existing shadcn `Command`/`Popover` primitives: fetches `people` via React Query (`["people"]`), merges with `PRIMARY_PERSONS` labels, and offers inline create via `supabase.from("people").insert({ name })` followed by cache invalidation.
- Swap the `Select_` for "Primary person" in `src/routes/catalog.tsx` and the corresponding field editor in `src/routes/letters/$archiveId.tsx` to use it.
- `PRIMARY_PERSONS` in `src/lib/archive.ts` stays as the seed/default list.
