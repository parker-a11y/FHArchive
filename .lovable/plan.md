# Connect AI Analysis to the Archive

Right now the AI tab on an FH record only displays suggestion slots and a notice that
nothing is wired up. The `ai_suggestions` table, the review UI (accept / edit & accept /
reject) and the pending-suggestions queue already exist — what is missing is the piece
that actually generates suggestions, plus a way for an accepted suggestion to land in
the record.

## What you'll get

On each record's **AI Analysis** tab:

- An **Analyze this record with AI** button (and a "Re-analyze" option once suggestions exist).
- The analysis reads the record's transcription (your corrected text when it exists,
  otherwise the AI transcription) together with the catalog fields already entered —
  date, people, places, record type, notes.
- Results land as **pending suggestions** in the existing slots: short summary, detailed
  summary, keywords, people, places, units, ships, organizations, events, quotations,
  uncertain passages, research questions, related records.
- Nothing is written to archival metadata automatically. Every suggestion stays
  "AI-GENERATED · awaiting review" until you accept it.
- If the record has no transcription yet, the button explains that and points to the
  Transcription tab instead of failing silently.

Accepting a suggestion becomes meaningful:

- Short / detailed summary → written into the record's summary fields.
- Keywords, people, places, organizations, events → creates or links the matching
  archive entities for that record, tagged as AI-sourced so you can tell them apart
  from entries you made by hand.
- The remaining slots (quotations, uncertain passages, research questions, related
  records) stay as reviewed notes on the suggestion itself; accepting just marks them
  kept. Every accept is logged to Edit history.

The Queues page keeps working as-is and will start showing real pending counts.

## Technical notes

- New `src/lib/ai-analysis.functions.ts` (`analyzeRecord`) + `src/lib/ai-analysis.server.ts`,
  following the existing transcription pair: authenticated server fn with
  `requireSupabaseAuth`, heavy logic imported inside the handler.
- Model: `google/gemini-3.7-flash` through the Lovable AI Gateway using the existing
  `LOVABLE_API_KEY`, requesting a single JSON object keyed by the `AI_FIELDS` keys.
  Gateway errors are surfaced per the standard rules (429/5xx retry with backoff;
  402/403 shown to you as-is, no silent retry loop).
- Suggestions are upserted into `ai_suggestions` on `(letter_id, field_key)` with
  `status = 'pending'` and the model name recorded. Re-analysis replaces pending rows
  and leaves accepted/rejected ones unless you explicitly re-run that field.
- A migration adds the unique `(letter_id, field_key)` constraint needed for that upsert
  (checked: the table has no such constraint today).
- Accept handling moves into a small `src/lib/ai-analysis.ts` helper so the panel can
  apply summary fields and entity links, reusing existing keyword/person/place helpers
  and the `source = 'ai'` column already present on the join tables.
- `AiPanel` in `src/components/letter/ResearchPanels.tsx` gains the run button, progress
  and error states, and replaces the placeholder notice with a short explanation that
  suggestions never write metadata without review.
