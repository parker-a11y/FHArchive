# Ask Francis: the whole archive, built for 1,000 records

Today Ask Francis guesses at 20 records and only shows those to the AI, so a question about a word that appears in one letter can come back "not present" while the letter sits right there.

The archive is 85 records now (about 237,000 characters) and heading for 1,000+. Simply pasting everything into each question works today and fails later, so the design below is the one that holds at 1,000: **nothing is ever silently excluded, and the way records are found does not depend on guessing the right keyword.**

## Three things run on every question

1. **A literal word check across the entire archive.** Every distinctive word in your question is searched, as text, against all record text in the database — not against a shortlist. The answer then knows, as fact, whether "baboon" appears anywhere and in which records. This is a cheap database count and stays cheap at 10,000 records.
2. **Meaning-based search.** Each record is indexed once by meaning, so "the monkey he saw at the zoo" finds a letter that says baboon, and "homesick" finds letters that never use the word. This is what makes retrieval reliable rather than keyword luck.
3. **Existing keyword and record-number matching**, kept as-is — a record you name by number is always included.

Results from all three are merged, so a record found by any route is in the answer's evidence.

## What the AI actually reads

A tiered brief instead of a hard cutoff:

- **Full text** for the strongest matches (as many as fit a generous budget).
- **Condensed entry** — title, date, people, places, summary, plus the passages around your search terms — for every other record that matched anything.
- **Archive-wide facts** computed in the database, not sampled: total record count, date range, and the exact word-presence table from step 1.

So an absence is a real absence, and at 1,000 records the brief stays roughly the same size — it is the strongest matches that fill it, not the whole shelf.

## Honest wording

The footer changes from "20 records retrieved" to something like "all 85 records searched; 24 read in full". The AI is told when a claim of absence is a verified archive-wide fact, and it must then say so plainly rather than hedging with "not in the retrieved set".

## Cost and speed

Indexing by meaning is a one-time cost per record (and on re-transcription), fractions of a cent each. Questions stay close to today's cost because the brief is budgeted, not unbounded. The word check adds no meaningful time.

## Technical notes

**Semantic index**
- Migration: enable `vector`; new `research_chunks` (`kind`, `archive_id`, `chunk_index`, `content`, `embedding vector(3072)`, `token-ish length`, timestamps), FK-free but keyed to `research_index`, HNSW index on `(embedding::halfvec(3072)) halfvec_cosine_ops`, GRANTs (`service_role` all; no anon), RLS on with authenticated read only.
- `match_research_chunks(query_embedding, match_count)` SQL function, cosine, casts matching the index.
- Chunking: ~1,200 chars with 200 overlap, over `body` plus a metadata header line.
- Embeddings via the gateway `/v1/embeddings`, `google/gemini-embedding-2`, batches of ≤100, server-side only.
- New `src/lib/research/embed.server.ts` + a server function to (re)index: incremental by content hash, invoked from the existing research-snapshot refresh so "Refresh Search Snapshot" also refreshes the meaning index. Progress + counts surfaced on the existing snapshot UI.

**Retrieval rewrite** (`src/lib/research/agent.server.ts`)
- `termPresence(admin, question)`: for each stopword-filtered term, a `count: exact, head: true` query with `ilike` across `body/title/summary/people/places/keywords`, plus the FH ids of up to 10 matches. Runs in parallel; produces a `TERM PRESENCE (verified against all N records)` prompt block.
- `semanticHits(question)`: embed the question, call `match_research_chunks` (top ~40 chunks), collapse to records with best-chunk score.
- Merge scores: semantic + existing FTS/IDF keyword passes + pinned FH/DS ids, normalized per channel.
- `buildEvidence()` replaces the hard `slice(limit)`: full `body` (cap 15,000 chars) for top records until a 300,000-char budget is used; every other matched record emitted condensed with up to two ±300-char term snippets. Nothing that matched is dropped.
- `ResearchAnswer` gains `corpus: { total, full, condensed, absent_terms: string[] }`.

**Prompt/UI**
- `SYSTEM`: add the verified-absence rule and the tiered-evidence explanation; keep every existing anti-fabrication rule.
- `src/routes/_authenticated/ask.tsx` and the admin history page render the corpus line; persist `corpus` as a jsonb column on `ask_francis_queries` (migration with GRANTs matching the table).
