# Add normalized date + precision to Digital Sources

## Goal
Keep **Original date (as shown)** free-form for display, and add a separate machine-readable **Normalized date** + **Precision** so Digital Sources can be sorted/filtered chronologically later.

## Changes

### Database
- Add `normalized_date` (date, nullable) and `date_precision` (text, default 'unknown') columns to `public.digital_sources`.
- Update the `create_digital_source(...)` function to accept `p_normalized_date` and `p_date_precision` and write them on insert.

### Frontend types & helpers
- Update `DigitalSource` and `NewSourceInput` types in `src/lib/sources.ts`.
- Update `createDigitalSource` to send the new fields.

### Add Source form
- In `src/routes/sources/new.tsx`, add:
  - **Normalized date** — date input.
  - **Date precision** — select from existing `DATE_PRECISION` options (exact, month, year, approximate, range, undated, not_applicable, unknown).
- Keep **Original date (as shown)** as the free-form display field.

### Source list / detail
- Update `src/routes/sources/index.tsx` to sort by `normalized_date` and show the original date in the row.
- Update `src/routes/sources/$dsId.tsx` to display both the original and normalized dates with precision.
