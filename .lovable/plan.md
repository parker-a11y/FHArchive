# Envelopes: no transcription, cleaner review

Three changes, all limited to envelopes.

## 1. Envelopes are never transcribed

- Envelope scans (labelled Envelope Front / Back) no longer appear in the AI transcription area at all — no per-scan box, no "Transcribe with ChatGPT" button, and they are skipped by "Transcribe entire record" and "Human verify all".
- They stay fully visible in Scans & Digitization and in Envelope Review, where you read them yourself.
- They already never counted toward the combined record transcription or toward a record being verified; that stays true.

## 2. Clear out the old envelope text

- Delete the 40 saved envelope transcriptions attached to 34 records.
- Records keep their letter transcriptions, their people, places and keyword tags, and their AI suggestions — only the envelope text goes.
- Combined record transcriptions are refreshed for those records so no envelope wording lingers in the rolled-up text.

## 3. Add people and places from Envelope Review

In the review pane on the right:

- **Mailing origin** and **Mailing destination** become place pickers: start typing and either pick an existing place or choose "Add <name> as a new place". The typed wording is still what gets saved to the record, and the new place is also linked to the record as origin / destination.
- A **Sender** and **Addressee** picker is added, using the same person picker as the record form — pick an existing person or create a new person record, with the usual match check so Fran / Jaq don't become duplicates.
- Postage / postal service keeps its existing "add new" behaviour.
- Save and Save & Next work as they do now and write the new links along with the postal fields.

## Technical notes

- `isEnvelopePage` (src/lib/transcription.ts) already identifies envelopes; use it to filter the file list rendered by `TranscriptionPanel` and the selection used by record-level transcribe/verify actions. Server side, `isEnvelope` in `transcription.server.ts` additionally guards single-scan transcription so an envelope can't be transcribed via a direct call.
- Cleanup: delete `scan_transcriptions` rows whose `file_id` points at a digital file matching `envelope`, then re-derive `letters.transcription_rollup_text` for the affected records using the existing rollup logic.
- Envelope Review reuses `PersonCombobox` / `MatchPersonDialog` and a place combobox modelled on the record form, writing to `letter_places` (roles origin/destination) and `letter_people` (roles sender/addressee) with `source = 'manual'`; letter text fields `origin` / `destination` continue to hold the as-written wording.
