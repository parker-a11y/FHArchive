# Star / "Of Extreme Interest" Flag

Add a simple star flag to FH Records and Digital Sources so the most important entries can be found instantly, and let a starred item generate a Note from the Archive.

## What you get

- A star toggle on FH Record entry (Quick Entry) and detail pages, and on Digital Source entry and detail pages.
- A star column/icon in All Records and Digital Sources lists, clickable to toggle without opening the record.
- A "Starred only" filter on All Records, Digital Sources, and Search, plus a dashboard tile "Of extreme interest" that opens the starred list.
- When you star an item, a dialog opens with a prefilled note, e.g. "An archive item of interest has been added: FH0007 — Bell Bottom Trousers." You can edit or add a sentence, then Post, or Skip. Posting saves it to Notes from the Archive.
- Unstarring never touches existing notes; they stay as a permanent log.

## Technical notes

- Migration: add `starred boolean not null default false` to `public.letters` and `public.digital_sources`; partial indexes `where starred` on both for fast filtering. No new tables or grants needed.
- Reuse `record_categories`-style patterns already in place; star toggles are plain updates through the existing owner-scoped RLS policies.
- New shared component `src/components/StarToggle.tsx` handling optimistic toggle, cache invalidation, and (on turning the star on) opening a confirm-note dialog.
- Note creation reuses the existing `archive_notes` insert path from `src/components/ArchiveNotes.tsx`; extract the insert into a small shared helper so both the ledger composer and the star flow use it. Only admins can post notes today, so guests just get the star with no note dialog.
- List/filter wiring: add `starred` to the slim projections in `src/lib/queries.ts`, add a `p_starred boolean` parameter to the `search_letters` RPC, and add a `starred` search param to the `/letters` route schema (coerced, cleared by Reset filters).
- Dashboard: extend `dashboard_stats()` with starred counts and add the tile in `src/routes/_authenticated/index.tsx`.
- Exports (CSV/Excel) gain a Starred column.
