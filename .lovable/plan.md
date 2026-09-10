# Generate Custom Recap

Add a "Generate Custom Recap" option to the Weekly Recaps module. Instead of being tied to one week, a custom recap can cover any date range (or the whole archive) and is written according to the instructions the user gives.

## What the user sees

On the Weekly Recaps page, a second button next to "Generate Weekly Recap Now": **GENERATE CUSTOM RECAP**. It opens a dialog with:

- **Period** — a start and end date, or "Everything in the archive". Dates match when records were catalogued, with a toggle to use the letters' own dates instead.
- **How many records to use** — a number (default 40, max 120). The most relevant records for the chosen focus are used first; starred finds and richer records win ties.
- **Level of detail** — Brief (a few paragraphs), Standard (about a page), In-depth (long-form, several pages).
- **Focus** — free text: people, places, events or subjects to centre the recap on.
- **Tone / audience** — Family storytelling (default), Research notes, or Formal summary.
- **Other instructions** — free text for anything else ("skip the statistics", "end with open questions").

Generating writes a new recap that appears in the same Weekly Recaps list, labelled **Custom** with its date range instead of a week range. Opening it uses the existing recap page, so editing, refining with AI, publishing and emailing all work exactly as they do today.

Custom recaps never overwrite a weekly recap, and generating one does not change the Sunday schedule.

## Guardrails kept from the weekly recap

Same writer rules: only real archive material, every fact cited by record number, no invented people, quotes or dates. The focus text and instructions steer emphasis and length, never the facts.

## Technical notes

**Database migration**
- `weekly_recaps`: add `kind text not null default 'weekly'`, `slug text`, `range_label text`, `params jsonb not null default '{}'`.
- Replace `unique (week_start)` with a partial unique index on `week_start` where `kind = 'weekly'`, plus a unique index on `slug`. Existing rows keep working unchanged.
- Custom rows still fill `week_start`/`week_end` with the range bounds (so ordering and the existing list query need no change) and carry a slug like `custom-2026-09-10-a3f2`.

**Server (`src/lib/recaps/weekly.server.ts`)**
- Extract the current `gatherWeek` into a range-based gather that takes `{ from, to, dateBasis, limit, focus }`; the weekly path calls it with the week bounds so its behaviour is unchanged.
- Focus terms narrow/rank the record set before the limit is applied (title, summaries, people/places/events/keywords, indexed body).
- New `runCustomRecap(params)` builds the prompt from the shared SYSTEM rules plus a custom block for detail level, tone/audience, focus and free-text instructions; detail level also sets the section guidance (Brief drops "Worth Exploring", In-depth allows more paragraphs per section).
- Insert-only, returning the new row's slug.

**Server function (`src/lib/recaps.functions.ts`)**
- `generateCustomRecap`, `requireSupabaseAuth` + the existing archive-access check, with validation on dates, record count, enum fields and instruction length (4000 chars).

**Client**
- New `CustomRecapDialog.tsx` under `src/components/recaps/`, opened from `src/routes/_authenticated/recaps/index.tsx`; on success navigate to the new recap.
- `src/lib/recaps.ts`: `WeeklyRecap` gains `kind`, `slug`, `range_label`, `params`; `fetchRecap` looks up by slug when the route param is not a `YYYY-MM-DD` date.
- `src/routes/_authenticated/recaps/$weekStart.tsx` and the list item show the range label and a Custom badge for custom recaps; refine/email/publish paths are untouched (they key off the row id, or fall back to id for custom rows where they currently use `week_start`).
