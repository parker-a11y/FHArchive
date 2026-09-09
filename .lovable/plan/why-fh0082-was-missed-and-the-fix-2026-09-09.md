# Why FH0082 was missed, and the fix

Your search snapshot is fine. FH0082 is in the research index, with its full 6,153-character
text, dated 13 Sept 1945 — and it is the only record in the whole archive that mentions
Kuching. The problem is in how Ask Francis picks which 14 records to hand the AI.

## What actually went wrong

Three flaws in the record-picking step, all confirmed against the live data:

1. **A named FH number is not pinned.** "FH0082" in your question is treated as just another
   search word. It is not guaranteed a seat among the records sent to the AI.
2. **Only the first eight words of a question get the keyword pass.** Your question's
   distinctive words — "Kuching", "incident", "context" — were words nine, ten and eleven, so
   the one word that uniquely identifies FH0082 was never used to boost it.
3. **Common words score the same as rare ones.** "Fran" appears in 76 of 85 records, "Jaq" in
   64, "letter" in 47. Those gave dozens of records the same score, and the tie is broken
   alphabetically by record number — so FH0082, the highest number in the archive, lost every
   tie and fell off the end of the list.

Net effect: the letter you asked about by name was the single most likely record to be dropped.

## The fix

- **Always include records named in the question.** Any FH number (or DS number) you type is
  fetched directly and placed at the top of the evidence, regardless of scoring.
- **Score rare words higher.** A word found in a handful of records counts far more than one
  found in most of them, so "Kuching" outweighs "letter".
- **Use the whole question**, not the first eight words.
- **Break ties by relevance, then date** instead of alphabetically by record number.
- **Raise the evidence limit** from 14 to 20 records, keeping pinned records outside that
  budget so a directly named letter can never be crowded out.
- **Say so honestly when a record truly is missing.** If a named FH number does not exist in
  the index, the answer states that plainly rather than reasoning around it.

Once this is in, re-asking the FH0082 question will analyse the actual letter and place the
Kuching passage in context — with the historical background sourced as it is now.

## Technical notes

All changes are in `src/lib/research/agent.server.ts`, in `retrieveEvidence`:

- Extract `/\b(FH|DS)\s?-?\d{3,4}\b/gi` from the question, normalise, and fetch those rows
  from `research_index` by `archive_id`; mark them `pinned` and prepend after scoring.
- Replace the flat weights with an IDF-style weight: run one `count` per term (or derive it
  from the returned hit set) and weight each keyword hit by `log(total / hits)`.
- Drop `terms.slice(0, 8)`; cap at ~12 terms and stopword-filter as today.
- Sort by `score` desc, then `sort_date`, and only then `archive_id`.
- `limit` default 14 → 20; pinned records are added on top of that slice, deduplicated by
  `kind:archive_id`.
- In `SYSTEM`/prompt: when a record ID appears in the question but not in the evidence,
  require an explicit "that record is not in the retrieved set" statement — the current
  behaviour of narrating around the gap stays disallowed.

No database, snapshot, or index changes are needed.
