# Ask Francis reads the whole archive

Today Ask Francis picks 20 records it guesses are relevant and only shows those to the AI. So a question about a word that appears once — "baboon" — can be answered "not present" when the letter is sitting right there.

The whole archive is small enough to hand over in full. All 85 records together are about 237,000 characters of text, well inside what the model can read in one go. So we stop guessing.

## What changes

- **Every question sees every record.** No more 20-record window. The full archive text is sent with each question.
- **Word questions are answered exactly.** Before answering, the system does a literal search across all record text for the distinctive words in your question. If "baboon" is nowhere in the archive, the answer says so as a fact, not a guess. If it appears in three letters, those three are named and pulled to the front.
- **Honest wording.** The answer footer changes from "20 records retrieved" to "all 85 records searched", and the AI is told it is seeing the complete archive — so "I did not find it" now means it is not there.
- **It keeps working as the archive grows.** Under roughly 300 records the full text goes in. Above that, the most relevant records keep their full text and the rest are included in condensed form (title, date, people, places, summary, plus any passage matching your question) so nothing ever drops out of view entirely.
- Records named by number (FH0082) stay pinned, and outside historical research is unchanged.

## Trade-offs

Each question costs somewhat more in AI credits and takes a little longer, since it reads everything. That is the price of never missing a record, and at this archive size it is modest.

## Technical notes

All in `src/lib/research/agent.server.ts`:

- Add `loadFullCorpus(admin)`: pages `research_index` with `.range()` (1,000-row pages) so nothing is silently truncated; returns all rows using the existing `SELECT`.
- Add `exactTermReport(rows, question)`: for each meaningful question term (existing stopword filter), count records whose `body`/`title`/`summary`/metadata contain it as a substring, plus a word-boundary variant. Produces a `TERM PRESENCE` block injected into the prompt listing each term as absent or naming the matching FH numbers.
- Replace `retrieveEvidence`'s role: keep its scoring (FTS + IDF keyword passes + pinned IDs) but use it only to *rank*, not to *filter*. New `buildEvidence()`:
  - budget-driven: full `body` (cap 15,000 chars each) for as many top-ranked records as fit in a 400,000-char budget;
  - remaining records emitted in condensed form — metadata + summary + up to two ±300-char snippets around question-term matches.
- `answerResearchQuestion`: prompt header states the complete archive is supplied and gives archive size; add the TERM PRESENCE block; keep the "record named but missing" rule (now it means genuinely absent).
- `SYSTEM`: add a rule — when the supplied evidence is the complete archive, an absence claim is a definite finding ("no record in the archive uses that word"), and it must not be hedged as "not in the retrieved set".
- `ResearchAnswer` gains `corpus: { total: number; full: number; condensed: number }` so the UI can show "all N records searched".
- UI text: `src/routes/_authenticated/ask.tsx` (and the admin history view) render the new corpus line in place of "N records retrieved". Persist `corpus` alongside existing fields in `ask_francis_queries` (jsonb column, migration with GRANTs matching the table).
