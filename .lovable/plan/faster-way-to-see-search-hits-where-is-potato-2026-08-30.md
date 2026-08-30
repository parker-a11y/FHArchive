# Faster way to see search hits ("where is POTATO?")

Today a search result shows one plain snippet from the verified transcription only, with no highlight and no way to jump straight to the passage. You have to open the record, open Transcription, and hunt.

## What changes on the Search page

1. **Highlighted matches, not plain text.** The search term is visually highlighted in every snippet (same highlight style already used inside transcriptions).
2. **All matches, not just the first.** Each result shows up to 3 snippets around the term, with "+N more matches" when there are more.
3. **Say where the match is.** Each snippet is labelled with its source: Verified transcription, AI transcription, Notes, Summary, Title, Keyword, Person, Place, Research notes — and for page-level scan transcriptions, the page label (e.g. "Page 3").
4. **Jump straight to it.** Each result gets an "Open at match" link that opens the record with the transcription tab already open and the term highlighted (the existing `?hl=&tab=` deep link used by Keywords). Clicking an individual snippet does the same.
5. **Expand in place.** A "Show full context" toggle on a result expands the surrounding paragraph inline, so simple lookups need no navigation at all.
6. **Hit counts.** Each result shows "7 matches" next to the FH number, so you can tell a passing mention from a heavily discussed topic.

## Also

- Search will look inside **per-page scan transcriptions** as well, so page-only text is findable and reportable as a page number.
- Snippet building runs on the results already returned, so no extra queries per keystroke.

## Technical details

- `search_letters` gains an optional match-context output: for the query term, return the matched field name and page label alongside each row (extend the RPC's returned columns, plus a `scan_transcriptions` clause in the `$22` text-search block, which it currently omits).
- New `src/lib/highlight.ts` with shared `findMatches` / `buildSnippets` helpers; reuse the existing `HighlightedText` from `TranscriptionPanel.tsx` by extracting it there.
- `src/routes/_authenticated/search.tsx` renders the snippet list, counts, labels, expand toggle, and `Link to="/letters/$archiveId" search={{ hl: q, tab: "transcription" }}`.
- No schema changes, no data changes; RPC signature change only adds output columns.
