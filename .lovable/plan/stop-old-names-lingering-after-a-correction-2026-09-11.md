# Stop old names lingering after a correction

## What I found on your record

FH0081 now has the accepted name list "Gary, W. C. Jannings" — but the record is still
linked to the old person **Cary**, and that link was created by the AI. So the tag stayed
behind even though the AI's answer changed.

Why: the clean-up step only removes names by comparing the *previously accepted wording
stored on that suggestion*. On FH0081 that stored "before" text is empty, so there was
nothing to compare against and nothing was offered for removal.

(For reference, FH0040 also links Cary — but there the accepted answer still says Cary,
so that one is correct and must be left alone.)

## The fix

1. **Compare against the record itself, not just the stored before-text.**
   Whenever a people / places / organizations / ships / events answer is accepted, look at
   the links that already exist on that record and were created by the AI. Any of them that
   the newly accepted answer no longer mentions is offered for removal, with your
   confirmation. Links you made by hand are never touched, and names that came from a
   different accepted field stay.

2. **A one-time archive-wide sweep.**
   A "Find leftover names" action (Archive tools) scans every record for AI-created people,
   place, organization and event links that no accepted AI answer supports any more. It
   shows the list — record, name, kind — and removes only what you check. Nothing is
   deleted automatically.

3. **FH0081 specifically.** It will show up in that sweep as "Cary — no longer supported",
   and unlinking it there also leaves an Edit history entry. The person record Cary itself
   stays in the archive, because FH0040 still uses it.

## Technical notes

- `src/lib/ai-analysis.ts`: add `unsupportedAiLinks(letterId, fieldKey, newContent)` that
  reads the existing link rows with `source = 'ai'` for the field's link table, joins the
  entity name, and returns those absent from the newly accepted list (same normalisation as
  `suggestionRemovals`). `applySuggestion`'s accept path in `ResearchPanels.tsx` uses this
  union'd with the current `suggestionRemovals` result, so both the stored-before path and
  the live-links path are covered.
- Guard against cross-field false positives: for a given field only consider links whose
  entity kind maps to that field (people vs organizations vs events), and skip names present
  in any other accepted suggestion on the same record.
- Sweep: a protected server function paging over letters, building the supported-name set
  from `ai_suggestions` rows with `status in ('accepted','changed')`, diffing against
  `letter_people` / `letter_places` / `letter_organizations` / `letter_events` rows with
  `source = 'ai'`, returning candidates. Deletion happens only for the ids you confirm, via
  the existing `unlinkSuggestionEntities` path, with `logEdits` for each.
- No schema change needed.
