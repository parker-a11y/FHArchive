# Fix: status dot out of sync with verified transcriptions

## Root cause (confirmed)

FH0001's scan-level transcription row (`scan_transcriptions`) is `human_verified`, but the record-level `letters.transcription_status` is still `ai_transcribed`. The traffic-light dot on All Records reads `letters.transcription_status`, so FH0001 shows yellow even though its page was human checked. The two statuses drifted apart — nothing syncs the record-level field when a scan transcription is verified.

## Fix

1. **Backfill** existing records: set `letters.transcription_status = 'human_verified'` where every existing scan transcription for the letter is human-verified (at minimum FH0001; run for all letters).
2. **Keep in sync going forward**: when a scan transcription's status is changed to `human_verified` in the Transcription panel, update `letters.transcription_status` to `human_verified` (and revert to `ai_transcribed`/`pending` appropriately if verification is undone). If a per-letter rule already exists elsewhere, reuse it.

## Technical details

- Files: `src/components/letter/TranscriptionPanel.tsx` (and/or the transcription server functions in `src/lib/transcription.functions.ts`) — update `letters.transcription_status` after verify/unverify.
- Backfill via one-time SQL update on `letters` joined against `scan_transcriptions` statuses.
- Verify: FH0001 shows green on All Records; toggling verification flips the dot.

## Result

FH0001 (and any similar record) shows the green "Transcribed & human checked" dot, and the dot stays accurate as transcriptions are verified in future.
