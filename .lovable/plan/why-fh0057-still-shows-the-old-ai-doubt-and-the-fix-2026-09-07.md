# Why FH0057 still shows the old AI doubt — and the fix

## What's actually happening

The note you're still seeing is not new. On FH0057 the "Uncertain passages" suggestion
was **rejected** at 02:38, and your re-analysis ran at 02:39. When the AI re-runs, it
deliberately leaves alone any suggestion you have already accepted or rejected, so that
your review decisions are never overwritten. The consequence is that the old rejected
text stays attached to the record and keeps being displayed — even though the AI's fresh
read of your corrected transcription never produced it again.

Your correction itself did save correctly: both pages are marked human-verified and the
record's combined text was rebuilt, so the analysis did read the corrected wording.

## What to change

1. **Re-analysis clears superseded doubts.** When you re-run the analysis, a field the AI
   no longer flags (for example, uncertain passages it can no longer see a problem with)
   is cleared instead of leaving the old rejected/accepted text sitting on the record.
2. **Re-run with a choice.** The AI tab's re-analyze control gets two options:
   - *Re-analyze new fields only* — today's behaviour, keeps everything you already reviewed.
   - *Re-analyze everything* — replaces all suggestions with a fresh read, including ones
     you accepted or rejected before. Accepted metadata already written into the record
     (summaries, names, places) is not touched.
3. **Rejected suggestions stop cluttering the tab.** A rejected item collapses into a
   single quiet "1 rejected suggestion — show" line instead of sitting in the list.
4. **Clean up FH0057.** Remove the stale rejected "uncertain" note about the Page 3
   envelope so the record reflects the corrected transcription.

## Technical notes

- `src/lib/ai-analysis.functions.ts`: add a `mode: "new" | "all"` input. In `all` mode skip
  the `locked` filter and upsert every returned field with `status = 'pending'`; in both
  modes delete existing rows for `ANALYSIS_FIELDS` keys the model returned empty, so
  superseded flags disappear rather than persisting.
- `src/components/letter/ResearchPanels.tsx` (`AiPanel`): split-button / dropdown for the
  two re-run modes, plus a collapsed group for `status === 'rejected'` rows.
- One-off SQL: delete the `uncertain` row for letter `71aa7f9a-…` (FH0057).
- No schema change needed; the `(letter_id, field_key)` unique constraint already supports
  the upsert.
