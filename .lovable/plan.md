# Transcribe Selected + five-stage status colors

## 1. "Transcribe Selected" on All Records

- The table already supports selecting rows. When one or more selected records are in the "scans uploaded, transcription pending" (yellow) stage, a **Transcribe Selected (n)** button appears next to "Email selected".
- Pressing it queues those records for transcription one at a time, showing progress ("3 of 8…") and a summary at the end.
- Only records that actually have scans are sent; anything else in the selection is skipped and reported.
- Envelopes stay excluded, exactly as they are today.
- Results are saved as AI transcription only — nothing is accepted or human-verified automatically.

## 2. Five-stage color system

| Color | Meaning |
| --- | --- |
| Red `#FF5F57` | No scans, or a transcription problem |
| Yellow `#FEBC2E` | Scans uploaded, transcription pending |
| Blue `#3B82F6` | Transcribed (AI), not yet verified |
| Purple `#8B5CF6` | Transcription verified, AI analysis not finished |
| Green `#28C840` | Everything done: verified transcription and AI analysis reviewed (or none needed) |

Rules:
- "Transcription not required" records skip the transcription stages and are judged on the AI-analysis stage only.
- AI analysis counts as finished when the record has AI results and none are still waiting for review (each one accepted or rejected). A record with no AI results yet and a verified transcription sits at purple.
- The legend under the table is updated to all five colors, and the Health dropdown and quick chips gain the two new stages ("Transcribed — needs verifying", "Verified — needs AI review"). "Needs attention" keeps meaning anything that is not green.

## 3. Auto-run AI analysis after verification

- When a record's transcription is human-verified (Human Verify All, or verifying the record-level transcription), AI analysis is started automatically in the background for that record.
- Its output lands as pending suggestions only — nothing is applied or marked final. The record moves purple → green only after you review those suggestions.
- A quiet toast confirms analysis was queued; a failure shows a non-blocking message and leaves the record at purple.

## Technical notes

- `src/lib/record-health.ts` gains a five-state function taking `{ scan_status, transcription_status, transcription_verified, ai_pending, ai_total }`; existing callers keep working through a compatible wrapper.
- Per-page AI review state comes from one extra grouped query on `ai_suggestions` for the ids currently displayed (no heavy join in list fetches).
- A migration replaces `search_letters` so `p_health` accepts `blue`/`purple` and the existing values match the new precedence, using a lateral count over `ai_suggestions`.
- Bulk transcription reuses the existing `transcribeRecord` server function, called sequentially from the client with a concurrency of 1 to respect gateway rate limits; 429/5xx retries with backoff, other errors stop that record and continue.
- Auto-analysis calls the existing `analyzeRecord` server function with mode `new`, fired after a successful verify in `TranscriptionPanel.tsx`.

## Verification

- Typecheck and build pass.
- A yellow record transcribed via the bulk button turns blue and remains unverified.
- Verifying it turns it purple and queues analysis; reviewing all suggestions turns it green.
