# Fill in "What was happening this day" for every archive date

Today the historical write-up for a date is only created the moment someone opens that date. 21 of the 187 days that carry a letter or source have one; 166 are still empty. This fills the rest quietly in the background, a few at a time, so nothing hits a service limit.

## How it works

- A small waiting list of dates is built from every day that has a letter or a digital source dated to it.
- A background job wakes up once an hour, takes the next 3 dates, writes their history, and stops. Roughly 70 days a week-day pace — the 166 remaining days finish in about two and a half days.
- If a day fails (service busy, credits, a hiccup), it is put back in line and retried later, up to three times, then marked as needing attention.
- Days already written are skipped. Hand-edited days are never touched.
- Finished write-ups are visible to readers immediately, exactly as they are today.

## What you will see

On the existing **On This Date Review** page, a progress strip at the top:

- "142 of 187 days written — 45 waiting, filling about 3 an hour"
- **Pause** / **Resume** button
- **Add missing days** button, which refreshes the waiting list after new records are catalogued
- Any day that failed three times is listed so you can retry it yourself

Nothing about how a reader sees a date changes.

## Technical details

**Schema (one migration)**
- `date_context_queue`: `on_date date primary key`, `status text` (`pending` | `done` | `error`), `attempts int default 0`, `last_error text`, `created_at`, `updated_at` + updated_at trigger.
- GRANTs: `select, insert, update, delete` to `authenticated`, `all` to `service_role`; RLS on, read for `can_read_archive(auth.uid())`, write for `can_edit_archive(auth.uid())`.
- `job_config` row `on_this_date_backfill` = `running` | `paused` (default `running`).

**Worker** — `src/lib/on-this-date.server.ts` gains `runDateContextBackfill(admin, limit = 3)`:
1. Returns early when the config flag is `paused`.
2. Selects up to `limit` `pending` rows ordered by `on_date`, skipping dates already in `date_contexts`.
3. Calls the existing `generateDateNarrative` + insert path (reuses `ensureDateContext`, so nothing about narrative quality or prompts changes), sequentially with a short delay between calls.
4. Marks `done`, or increments `attempts` and stores `last_error`; `attempts >= 3` becomes `error`.
5. Returns `{ processed, done, failed, remaining }`.

**Cron route** — `src/routes/api/public/on-this-date-backfill.ts`, guarded by `authenticateCronRequest`, mirroring `api/public/archivist-digest.ts`. Scheduled in the same migration with `cron.schedule('on-this-date-backfill', '7 * * * *', ...)` posting to the published URL with the `job_config.cron_secret` bearer, `timeout_milliseconds := 300000`.

**Queue seeding** — `enqueueMissingDateContexts(admin)` inserts distinct `normalized_date` from `letters` and `digital_sources` that have no `date_contexts` row, `on conflict do nothing`. Run once in the migration and exposed through an admin server fn behind the "Add missing days" button.

**Server functions** — added to `src/lib/on-this-date.functions.ts`, each gated by the existing edit-permission check: `getBackfillStatusFn` (counts by status + paused flag), `enqueueMissingDatesFn`, `setBackfillPausedFn`, `retryDateContextFn(date)`.

**UI** — progress strip + controls at the top of `src/routes/_authenticated/admin/on-this-date.tsx`, polling status every 30s while the page is open.

## Cost and limits

3 narratives an hour is one model call each, far below the AI gateway's rate limits, and the job exits immediately once the queue is empty, so idle hours cost nothing. Total for the backfill: about 166 narrative generations spread over roughly two and a half days.
