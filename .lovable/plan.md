# Quick Entry page polish — colors, required title, second Uploads Complete button

## What you'll see change

1. **"Create Short Title" button gets color**
   - Restyled from plain outline to a filled accent button (archive gold styling already in the theme) so it stands out next to the Title field.

2. **Title / Short Description becomes mandatory before saving**
   - All three save paths (Save & Create Next, Save & Open Record, Save & Print Label) check that Title/Short Description is filled in.
   - If empty: saving is blocked, a warning message appears, and the Title field is highlighted (red/destructive ring) and focused.
   - This applies only to Quick Entry (`catalog.tsx`); nothing else about the save flow changes.

3. **Second "Confirm Upload Complete" button near the thumbnails**
   - In `DigitizationPanel.tsx`, a duplicate colorized "Confirm Upload Complete" button appears directly below/above the scan thumbnail grid, so you don't have to scroll back to the top of the panel.
   - Same behavior as the existing button (unnamed-scan warning dialog, auto-submit for transcription, etc.).
   - The existing top button stays.

4. **Small visual splashes on the Quick Entry page** (kept tasteful, archive-paper aesthetic)
   - Archive ID number block gets a subtle gold accent treatment.
   - The health/status dot and quick-pick buttons (Fran, Jaq, Ft Schuyler, FPO, Worcester, NONE) get light color coding.
   - Section headers on the form get a thin gold rule/divider for visual separation.
   - Quick-action footer buttons get clearer color hierarchy (primary save filled, secondary actions softer).

## Technical details

- Files touched: `src/routes/_authenticated/catalog.tsx`, `src/components/letter/DigitizationPanel.tsx` only.
- Colors use existing semantic theme tokens (`--color-archive-gold`, `accent`, `primary`, `destructive`) — no hardcoded hex colors, dark/light theming preserved.
- Title validation is a client-side check in the `save()` function before any database call; started records (already claimed FH numbers) are validated too.
- No database, migration, or workflow changes.
