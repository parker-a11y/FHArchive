# Ask Francis: gaps found in the audit

No changes have been made. This is the short list of fixes the audit turned up, for you to approve or skip.

## 1. Build the meaning index (required — it is empty today)

The vector table exists but holds zero passages, so today's answers still come from
word matching only. Pressing "Refresh Search Snapshot" on the Ask Francis page builds
it. If you'd rather not wait on the page, the same job can be triggered for you.

## 2. Make the nightly job refresh the meaning index too

Right now only the manual button refreshes the meaning index. The 2am nightly job
rebuilds the word index but leaves the meaning index untouched, so a letter added
today would not be findable by meaning until someone presses the button.

Fix: have the nightly job run the meaning refresh right after the word index, and
record the counts in the snapshot record.

## 3. Refresh automatically when a record or transcription changes

Today nothing is searchable until a snapshot runs. Fix: when a transcription is
verified or a record is saved, mark that one record as needing re-indexing, and have
a small job pick up only the changed records (minutes, not overnight).

## 4. Index the material that is currently invisible to Ask Francis

Not currently searchable as records in their own right: Francis File Notes, people
records, place records, ship/organization records, and archive notes. They only reach
Ask Francis indirectly, as names listed on a letter.

Fix: add these as their own entries in the index so a question about a person, a place
or a File Note can retrieve them directly.

## 5. Filtered questions ("only Jan–Mar 1945", "only photographs")

Ask Francis cannot narrow a search by date range, sender, record type or tag before
searching. Fix: read those constraints out of the question and apply them as filters
during retrieval, both for word search and meaning search.

## 6. Growth safeguards for 800–1,500 records

- The word-by-word check runs one query per word; batch it into a single query.
- The meaning search looks at the 60 best passages; raise it and de-duplicate per record.
- The brief sent to the model is capped at 300,000 characters of full text; at 1,500
  letters this will always be full, so ranking quality matters more than the cap.

## Technical notes

- Vector store: Supabase Postgres + pgvector, table `public.research_chunks`
  (3072-dim, HNSW on a halfvec cast), RPC `match_research_chunks`.
- Embeddings: Lovable AI Gateway, `google/gemini-embedding-2`, ~1,200-char passages
  with 200-char overlap, each passage prefixed with a record header.
- Answer model: `google/gemini-3.7-flash` via the gateway chat endpoint, JSON mode.
- Retrieval/prompt: `src/lib/research/agent.server.ts`; embeddings:
  `src/lib/research/embed.server.ts`; ingestion: `src/lib/research/snapshot.server.ts`;
  entry point: `src/lib/research.functions.ts`; nightly job:
  `src/routes/api/public/research-snapshot.ts`.
- No OpenAI file search / vector stores, Pinecone, Weaviate, Qdrant or Chroma anywhere
  in the project.
