# Fix: FH numbers burn on every visit

## What's happening

The Quick Entry screen asks the database to *issue* the next FH number as soon as the page opens, and issuing a number permanently advances the counter. Opening the page twice (or React's development double-render) consumes two numbers, so the displayed ID jumps by 2 even though no letter was saved.

Confirmed in the database: the counter has already advanced to 8, while the letters table holds 0 records — 8 numbers have been burned with nothing saved.

## The fix

Separate *previewing* a number from *claiming* it.

1. **Preview only (page load).** Show the next number using a read-only lookup (highest used number + 1, plus the counter's current position). This never advances anything, so refreshing or reopening the page is free.
2. **Claim at save.** When Save is pressed, the number is issued and the letter row is inserted in one atomic database call, so a number only exists if the letter exists. The card on the form is labelled as the *provisional* ID, and the toast/record page shows the ID actually assigned.
3. **Reset the counter** back in line with reality (0 used numbers → next is FH000001) so the archive starts clean.

## Also being verified

Since zero letters exist, the plan's first implementation step is to save a test record and confirm it persists. If saving is failing silently (rather than simply never having been pressed), that fix ships in the same change.

## Technical notes

- New security-definer function `public.create_letter(...)`: takes the catalog fields, advances `archive_counter` and inserts into `letters` in one transaction, returns the new row's `archive_id`. Keeps sequential numbering gap-free under concurrency.
- New read-only function or plain select for the preview value; `next_archive_id()` is no longer called from the client on mount (kept or dropped depending on other callers).
- `src/routes/catalog.tsx`: mount effect calls the preview; `save()` calls `create_letter` and uses its returned ID for the session list, toast, and navigation. Also guard the mount effect against double invocation.
- Migration also resets `archive_counter.last_seq` to match `max(fh_seq)` in `letters`.
