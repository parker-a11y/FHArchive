# All Records table — scale and health-filter improvements

## Goal
Make the All Records table easier to work with once it holds hundreds of records, starting with a quick filter that surfaces records needing attention (yellow or red health status).

## Proposed changes

1. Health-status filter
   - Add a new filter control at the top of `/letters` labeled "Health" with options: All, Green, Yellow, Red.
   - "Yellow" = scans uploaded but transcription still pending.
   - "Red" = no scans yet, or transcription failed.
   - "Green" = transcribed & human checked, or transcription not required.
   - Wire the filter into `search_letters` so it runs server-side and supports export.
   - Keep the existing colored-dot legend at the bottom of the table.

2. Compact filter bar
   - Move the less-used correspondence filters (Salutation, Addressee, Closing, Signature) into a collapsible "Correspondence" section so the top bar stays scannable.
   - Keep Type, Period, Transcription, ID status, Date status, Digitization, Tones, Health, and quick toggles always visible.

3. Quick-filter chips
   - Add one-click chips for common views: "Needs attention" (yellow + red), "No scans" (red), "Pending transcription" (yellow), "Starred".
   - These set the existing filter state, so the URL and export still work.

4. Optional: compact row density toggle
   - Add a small "Compact" toggle that reduces cell padding for denser browsing of large result sets.

## Out of scope
- No changes to pagination strategy (100 per page remains).
- No changes to the existing column set or inline editing behavior.
- No database schema changes beyond adding a health filter parameter to the search function.

## Verification
- Typecheck and build pass.
- Filter returns the expected yellow/red records.
- Export respects the health filter.
