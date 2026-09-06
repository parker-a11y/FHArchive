# Fix: "Numbering & Gaps" says there are no gaps

## What's wrong

Confirmed in the database: the highest FH number used is 51, two numbers (FH0048, FH0049) are recorded as retired, and the page still reports no gaps.

The cause is the counter that tracks the highest number ever issued: it is locked down so that no one — not even an admin — can read it from the browser. The page asks for it, gets nothing back, treats the highest issued number as zero, and therefore finds nothing to list.

## The fix

Stop relying on the locked counter for this page. Work out the gaps from information the page can actually see:

- the FH numbers that have records behind them,
- the retired-number ledger,
- the highest of those two as the end of the sequence.

So any number from 1 up to the highest known number that has no record behind it is listed — retired ones with their explanation, the rest flagged for review. With the current data the page will show FH0048 and FH0049 as retired duplicates, plus any other unexplained gap.

Also make the counter readable to admins so the page can still spot numbers that were issued but never saved (a burned number above the highest saved record).

## Technical notes

- Migration: add a `SELECT` policy on `public.archive_counter` for admins (`is_admin(auth.uid())`), leaving insert/update/delete admin-only as they are.
- `src/lib/numbering.ts` → `fetchNumberingGaps`: compute `last = max(counter.last_seq ?? 0, max(letters.fh_seq), max(retirements.fh_seq))` instead of trusting the counter alone; keep the rest of the loop unchanged.
- No change to numbering itself; FH IDs stay permanent and nothing is renumbered.
