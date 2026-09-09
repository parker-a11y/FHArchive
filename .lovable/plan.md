# Use the full Ask Francis question for record retrieval

## Goal
Stop truncating the researcher's question when retrieving archive evidence. Every word in the question should be eligible to match records, not just the first N terms.

## Current state
`src/lib/research/agent.server.ts` `retrieveEvidence` currently:

1. Cleans the question, drops stopwords and short words.
2. Slices the remaining terms to **12** (`terms.slice(0, 12)`).
3. Joins those 12 terms with `or` for the full-text search.
4. Runs a per-term keyword `ilike` pass for each of those 12 terms.

So a longer question has its tail ignored during retrieval. Named record IDs are already pinned separately, so this change affects keyword/FTS ranking only.

## Changes

### 1. Full-text search uses the whole question
Replace the term-join FTS query with the original cleaned question string (or a stopword-stripped but otherwise complete version). Keep `type: "websearch"` so Postgres can parse it naturally.

- Keep the existing cleanup: lowercase, replace punctuation with spaces, collapse whitespace.
- Remove stopwords and words under 3 characters.
- Pass the remaining full string to `.textSearch("fts", cleanedQuestion, { type: "websearch" })`.
- Do not cap the FTS input artificially.

### 2. Keyword pass keeps all meaningful terms
Remove `terms.slice(0, 12)`. Instead build the keyword term list from the full question, still filtered for stopwords/short words, with a generous upper bound (e.g., 50 terms) to guard against pasted essays.

- Run the existing per-term `ilike` query for each term.
- Keep the IDF weighting: `2 * max(0.2, log(total / rows.length))`.

### 3. Preserve performance safeguards
- Limit each per-term query to 60 rows (unchanged).
- Limit final scored slice to the caller's `limit` (default 20, unchanged).
- Keep pinned record IDs fetched separately and prepended without consuming the limit.
- Keep the recency backstop when fewer than 4 hits are found.

### 4. No prompt or schema changes
The `SYSTEM` prompt and `ResearchAnswer` shape stay the same. The only difference is the evidence sent to the model should now reflect matches from anywhere in the question.

## Files to change
- `src/lib/research/agent.server.ts` — `retrieveEvidence` function only.

## Verification
- Typecheck passes.
- Ask a long question whose important words appear after the 12th term; the resulting evidence should include records matching those late words.
- Ask the previous FH0082/Kuching question and confirm FH0082 is retrieved and ranked highly.
