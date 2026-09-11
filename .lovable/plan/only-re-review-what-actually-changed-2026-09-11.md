# Only re-review what actually changed

Today, once you correct a transcription (Cary → Gary), the AI review on that record is
frozen in time: the old accepted results stay as they are, and the only way to refresh
them is a full re-analysis where every field comes back for review again. This changes
that so a correction pushes through automatically and you only look at the fields whose
answers actually moved.

## What you'll get

When you save a transcription correction on a record that has already been AI-reviewed:

- The archive re-reads the record with AI right away, in the background.
- It compares each new result with the one you previously accepted.
- Fields whose answer is unchanged stay accepted and untouched — no re-reviewing.
- Only fields whose answer changed come back, marked **UPDATED**, showing the previously
  accepted text and the new text side by side, with **Accept update** or **Keep current**.
- The record's status light drops back to purple until you've dealt with the updated
  fields, so changed records are easy to spot on All Records.
- The AI tab shows a banner: "Transcription changed — X field(s) need a second look".

Accepting an update pushes the change into the record properly:

- Summaries and other text fields are overwritten with the new text.
- New names, places, organizations and events are added as before.
- Names the new reading no longer supports (the old "Cary") are listed for you to confirm
  before they are unlinked. Only links the AI created are ever offered for removal —
  anything you linked by hand is never touched.
- Every accept and unlink is written to Edit history.

The existing manual buttons stay: **Analyze**, and the full **Re-analyze everything** for
when you want a clean slate.

## Technical notes

- Migration: add `proposed_content text` and `superseded_at timestamptz` to
  `ai_suggestions`, plus `letters.ai_source_hash text` (hash of the transcript the last
  accepted review was based on). New status value `changed`.
- `analyzeRecord` gains `mode: "refresh"`. For each field it normalizes and compares the
  fresh text with the stored `content`:
  - accepted + identical → untouched, counted as unchanged;
  - accepted + different → `proposed_content` set, `status = 'changed'` (accepted
    `content` preserved for the diff);
  - pending/absent → behaves as today.
  `ai_source_hash` is written on completion.
- Auto-trigger: the transcription save path (`saveCorrections` / human-verify in
  `TranscriptionPanel.tsx` → existing record-status flow) fires `analyzeRecord` with
  `mode: "refresh"` when the record already has accepted suggestions and the transcript
  hash differs. Fire-and-forget with a toast; failures never block the save.
- `AiPanel` in `ResearchPanels.tsx`: `changed` rows render first with a two-column
  before/after view and Accept update / Keep current. "Keep current" clears
  `proposed_content` and restores `accepted`.
- `applySuggestion` in `src/lib/ai-analysis.ts` gains a removal pass for entity fields:
  diff previous vs new name list, look up existing links for this record with
  `source = 'ai'`, and delete only the confirmed ones (reuse the
  `ConfirmEntitiesDialog` pattern for the confirmation step).
- Health: `record-health.ts` and the status reconciliation treat a `changed` suggestion
  the same as pending — record is purple until reviewed.
