# Scale & Architecture Review — Preparing for 1,000+ Records

## The headline finding

The app is well-structured feature-wise, but nearly every list page works by **downloading entire tables into the browser and filtering in JavaScript**. With 6 records this is invisible; with 1,000+ records plus cross-references it becomes slow page loads, laggy typing in search boxes, and eventually silent wrong results.

One urgent hidden risk: the database API typically caps responses at 1,000 rows. The All Records page fetches the whole letters table with no limit — once you pass ~1,000 records, **the page may silently stop showing newer records**. Fixing pagination isn't just performance, it's correctness.

## What should change now (before bulk content entry)

1. **Paginate All Records** — load one page of records at a time (e.g. 100/page) with a real total count, and move filters (type, period, status, keyword text) into the database query instead of filtering in the browser. Same for the Search page.
2. **Move text search into the database** — search title/notes/author/recipient/transcriptions with SQL instead of downloading everything and string-matching per keystroke. Add trigram indexes so this stays fast at scale.
3. **Add missing database indexes** — two junction tables (`letter_organizations`, `letter_events`) have no index on `letter_id` at all, and no junction table has an index for reverse lookups (e.g. "all records mentioning this person"). The People/Places/Keywords detail pages depend on these.
4. **Virtualize the All Records table** — render only visible rows instead of 1,000+ rows × 21 columns of DOM.
5. **Fix count queries** — dashboard/file stats currently download every scan row just to count it; switch to database count queries (the Daily Summary already does this correctly).
6. **Debounce search boxes** — stop re-filtering on every keystroke.

## What can wait

7. **Search page query consolidation** — it currently fires ~13 unbounded queries per visit, some fetching the same junction tables twice; collapses naturally once pagination/search land.
8. **Batch signed URLs** — scan thumbnails are signed one storage call per file; switch to batch signing when grids of thumbnails appear.
9. **Keyword/source count queries** — same "download to count" pattern, lower traffic.

## What does NOT need to change

- **Database schema overall** — tables, relationships, RLS, and owner-scoping are sound for 1,000+ (even 100k+) records. No restructuring needed.
- **Storage architecture** — masters vs derivatives/thumbnails is correct; lists never load full TIFFs.
- **Record numbering, counters, merge/alias systems** — all fine at scale.

## Suggested order of work

- Phase 1 (correctness + indexes): migration adding missing indexes + trigram indexes; verify row-cap behavior.
- Phase 2 (All Records): server-side pagination, SQL filtering, debounced search, virtualized table.
- Phase 3 (Search page + counts): SQL-backed search, consolidate queries, fix count aggregations.
- Phase 4 (polish, optional): batch signed URLs, keyword/source count views.

## Technical details

- `fetchLetters()` in `src/lib/queries.ts:123` is the unbounded query used by Dashboard, All Records, and Search.
- `/search` fires ~13 unbounded queries including all of `scan_transcriptions` text.
- Missing indexes: `letter_organizations(letter_id)`, `letter_events(letter_id)`, reverse-FK indexes on `letter_keywords(keyword_id)`, `letter_people(person_id)`, `letter_places(place_id)`, `letter_organizations(organization_id)`, `letter_events(event_id)`.
- `pg_trgm` extension already enabled; add GIN indexes on `letters` text columns (`title`, `notes`, `author`, `recipient`, `summary_short`, `transcription_verified`).
- Virtualization via `@tanstack/react-virtual`.
- Signed-URL batching via `createSignedUrls` in `src/lib/digital-files.ts`.
- `fetchItemCounts()` in `src/lib/queries.ts:139` replaced with `count: "exact", head: true` aggregates.

No existing features, fields, or data are removed by any of this — it's purely how data is fetched and rendered.
