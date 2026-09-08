# Dateline — where the letter was written

A new field, **Dateline**, records the place written at the top of a letter (for example "Ft Schuyler" or "Somewhere in the Pacific"). It is separate from Mailing origin, which comes from the postmark. Dateline becomes the most trusted answer to "where was Francis on this date?"

## What you'll see

- **Quick Entry (new record):** a Dateline box directly under Date as written, with the same quick-pick style buttons already used for Origin (Ft Schuyler, FPO - San Francisco) so common places are one tap.
- **Record page:** Dateline sits under Date as written in the record details, editable like any other field, and shows in the read-only guest view.
- **Envelope review:** Dateline appears alongside Mailing origin, clearly labelled so the two are never confused ("Dateline — written at" vs "Mailing origin — postmark").
- **Folder label:** when a Dateline exists it prints on the label under the date line, as `Written at: Ft Schuyler`. Labels without a Dateline look exactly as they do today.
- **Ask Francis:** location questions prefer Dateline over Mailing origin. Records are described to the AI as "Written at (dateline): X" and, only if there is none, "Mailing origin (postmark): Y". Dateline is also searchable text and included in research exports and the weekly recap context.
- **AI analysis:** when a transcription exists, the AI can propose a Dateline as a pending suggestion you accept or reject — it never writes it silently.

## Technical notes

- Migration: add `dateline text` to `public.letters`; add the parameter `p_dateline` to `create_record`. No data backfill — Mailing origin values are not copied, since they mean something different.
- Types/queries: add `dateline` to the `Letter` type, `LETTER_LIST_COLS`, and `NewRecordInput`/`createRecord` in `src/lib/queries.ts`.
- UI: `src/routes/_authenticated/catalog.tsx` (field + quick picks + remembered-value handling consistent with existing behavior), `src/routes/_authenticated/letters/$archiveId.tsx`, `src/components/letter/ReadOnlyCatalog.tsx`, `src/routes/_authenticated/envelopes.tsx` (uncontrolled input pattern already used there, added to the save payload and the select list).
- Label: `labelLines()` in `src/components/letter/LabelDialog.tsx` gains a `Written at: …` line when `dateline` is set.
- Search: include `dateline` in the `search_letters` free-text match so "Ft Schuyler" finds it.
- Research/AI surface: add `dateline` to the selected columns and prompt lines in `src/lib/ai-analysis.server.ts`, `src/lib/research/agent.server.ts`, `src/lib/research/snapshot.server.ts`, `src/lib/recaps/weekly.server.ts`, and `src/lib/on-this-date.ts` / `on-this-date.server.ts`, with dateline listed before origin and labelled as the definitive written location.
- Research index: carry `dateline` into the indexed record text so Ask Francis retrieval matches on it; existing snapshot refresh repopulates it.
- AI suggestion: add a `dateline` field key to the analysis schema, surfaced in the existing pending-suggestions review UI (no auto-apply).
