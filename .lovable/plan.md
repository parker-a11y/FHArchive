# Tighten AI Tone Suggestions

The tone suggestion model is being too generous with emotions. The cause is its
instructions in `src/lib/tone-suggest.server.ts`, which currently tell it to be
"relatively broad and inclusive" and that "multiple tones are expected and
encouraged." That single prompt change fixes both the per-record "Suggest tones"
button and the Work Queues backfill tool, since both call the same server function.

## What changes

Rewrite the tone suggestion prompt to be more selective:

- Ask for the **dominant tones only** — typically 1–3, the ones a reader would
  name first after finishing the letter.
- Require each suggested tone to be **sustained or central**, not a passing
  mention (e.g. one wistful sentence in an otherwise chatty letter should not
  earn "Nostalgia").
- Explicitly say **more tones is not better** and that leaving a record with a
  single tone is fine.
- Keep the existing rules: prefer labels from the existing tone list, ground
  everything in the text, propose new tones only when clearly needed.

The confirmation dialog stays unchanged — you still review and uncheck anything
before it saves, so tightening the prompt just means less noise to uncheck.

## Technical notes

- Edit only the `SYSTEM_PROMPT` string in `src/lib/tone-suggest.server.ts`
  (lines 10–17). No schema, UI, or data changes.
- The fix applies immediately to both entry points: the letter-page tone
  suggestion button and the `ToneBackfillCard` batch tool on the Queues page.
- Existing saved tones are untouched.
