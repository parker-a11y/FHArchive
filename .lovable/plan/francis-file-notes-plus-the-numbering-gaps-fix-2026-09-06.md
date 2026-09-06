# Francis File Notes (plus the Numbering & Gaps fix)

## Part 0 — Quick fix first: "No gaps" is wrong

Confirmed in the database: the highest FH number used is 51 and FH0048/FH0049 are recorded as retired, yet the page says there are no gaps.

Cause: the counter that tracks the highest number ever issued is locked so nothing can read it from the browser. The page gets nothing back, treats the highest issued number as zero, and finds nothing to list.

Fix: work out the end of the sequence from what the page can see — the highest number that has a record behind it and the highest retired number — and also let admins read the counter so numbers issued but never saved still show. FH0048 and FH0049 will then appear with their explanation.

## Part 1 — What Francis File Notes is

A permanent, reusable knowledge record (a mini-Wiki entry) for a term, person, place, ship, event, or expression that appears anywhere in the archive. Created once, recognised everywhere. Original transcriptions are never altered — recognition happens only when text is displayed.

## Phase 1 — Foundation (first build)

- Note record: term, display title, expanded name, slug, category, short definition, historical background, Francis Files Context, images with captions and credits, sources, draft/published, AI-assisted flags, timestamps.
- Aliases: many per note, each with its own auto-link on/off switch so ambiguous words ("Barnes") can stay off.
- Public index at `/notes` — search, A–Z, by category, recently added, most mentioned.
- Full note page at `/notes/<term>` showing only the sections that have content.
- Admin area: table of notes with term, expanded name, category, alias count, appearances, status, auto-link, updated; edit, publish/unpublish, manage aliases, images, delete.
- Duplicate check on create: warns when the term, title, expanded name, or an alias already matches an existing note, offering "use existing" or "create anyway".

## Phase 2 — Recognition and reading experience

- Display-layer highlighting: subtle cream background with an understated dotted underline, slightly stronger on hover, clear cursor. Whole-word matching only, punctuation-tolerant, and only the first occurrence within a short block so a paragraph never looks annotated.
- Click or tap opens a compact popover: "FRANCIS FILE NOTE!", term, expanded name, short definition, Francis Files Context, primary image with caption, related topics, "Appears in N Francis Files", and "View Full Francis File Note". Closes with the X, clicking outside, or Escape; on phones it becomes a bottom sheet. Keyboard focus and screen-reader labels included.
- Applied first to letter transcriptions, record summaries, AI analysis text, weekly recaps, On This Date narratives, and Ask Francis answers; then to person/place/ship descriptions and captions.

## Phase 3 — Archive appearances, tagging, AI

- "Appears in the Archive": generated automatically from the archive's existing search index, with a short excerpt and a link to each record; also drives the appearance counts.
- Admin match tool when a note or alias is created: "YMS appears in 17 records" — review, accept, or ignore individual matches.
- Explicit tagging: an admin can select a word in a transcription or analysis and attach it to an existing note or create a new one from it, prefilled with the selected term. Auto-recognised, explicitly tagged, and AI-suggested occurrences stay distinguishable internally.
- AI assistance: generate a draft note (expanded name, category, aliases, definitions, Francis Files Context, related people/places/ships/notes, suggested sources) and regenerate individual sections. Nothing is ever published automatically; everything stays editable.
- Record analysis suggests candidate notes, checking the existing library first so it never proposes a duplicate.

## Phase 4 — Housekeeping

- Merge two notes into one, keeping aliases, tags, images, relationships, sources and redirecting the old address.
- Relationships between notes shown in both directions without double entry.
- Admin filters: published, draft, category, auto-link on, missing image, missing Francis Files Context, recently updated.

## Technical notes

- New tables: `ffn_notes` (slug unique, status, category, text fields, AI flags), `ffn_aliases` (note_id, alias, alias_norm, auto_link), `ffn_images` (note_id, storage path or existing media reference, caption, credit, primary flag, sort), `ffn_relations` (note-to-note, normalised pair like `record_links`), `ffn_entity_links` (note to existing person/place/organization/event/record — no duplication of those entities), `ffn_occurrences` (explicit tags and reviewed/ignored matches, with a `source` of auto / tagged / ai_suggested). All with GRANTs, RLS: approved archive readers select published rows, admins write.
- Public read of published notes for the unlisted share pages uses an `anon` select policy restricted to `status = 'published'`.
- Matching is pure application logic: one cached query returns published auto-link aliases (normalised, longest-first); a shared `annotateText` helper builds a regex with word boundaries and returns React segments. No AI at read time.
- Rendering hooks into existing display components (`TranscriptionPanel`, `RecapBody`, `ReadOnlyCatalog`, On This Date, Ask Francis answer view) — stored text is untouched.
- Appearances reuse `research_index` / `search_letters` full-text rather than a new crawler; counts cached on the note row and refreshed on demand.
- AI generation goes through a new `createServerFn` in `src/lib/ffn.functions.ts` using the gateway model already used for analysis.
- Routes: `src/routes/notes/index.tsx` and `src/routes/notes/$slug.tsx` (public), `src/routes/_authenticated/admin/notes/*` (admin), plus an Admin nav entry.

## Sequencing

Phase 0 fix ships immediately. Phase 1 next as one build, then Phase 2, then 3, then 4 — each reviewable on its own.
