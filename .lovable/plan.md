# Fix: FH0008 still labels as UNDATED

## What's happening

FH0008 does have a date saved (14 December 1944), but the record's **date status/precision** field is still set to `undated`. The label and date displays check that status first, so any record marked "undated" prints UNDATED regardless of the date stored on it.

FH0008 is currently the only record in this state.

## Fix

1. **Correct FH0008.** Set its date status to a real precision (exact day, since a full date is present). Its label then reads "December 14, 1944".
2. **Stop it happening again.** In both the record detail form and Quick Entry, when a date is entered while the status is `undated` / `unknown`, automatically promote the status to the matching precision (exact, month, or year based on what was entered). Clearing the date returns it to undated. The status dropdown stays fully editable, so it can still be overridden by hand.
3. **Belt-and-braces on display.** Where a record is flagged undated but a normalized date actually exists, render the real date rather than "UNDATED" — so no future mismatch silently hides a date on labels, the timeline, All Records, or shared pages.

## Technical notes

- Data fix: one-row update of `letters.date_precision` for FH0008 (`undated` -> `exact`).
- Form logic: date `onChange` handlers in `src/routes/_authenticated/letters/$archiveId.tsx` and `src/routes/_authenticated/catalog.tsx` set `date_precision` when the current value is `undated`/`unknown`.
- Display logic: `labelDate` and `displayDate` in `src/lib/archive.ts` only short-circuit to UNDATED when `normalized_date` is null; `not_applicable` keeps its current behaviour.
