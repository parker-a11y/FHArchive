# Default Identification Status to blank / not selected

## Goal
Change the FH Record Quick Entry form so the **Identification status** field starts empty ("— Select —") instead of defaulting to "Unidentified." Users must explicitly choose a status during intake.

## Changes

1. **Add a blank option to `IDENTIFICATION_STATUS`** in `src/lib/archive.ts`.
   - Insert `{ value: "", label: "—" }` at the top of the array so the native `<select>` can represent "not selected."

2. **Change the Quick Entry default** in `src/routes/catalog.tsx`.
   - Update the `blank` object: `identification_status: ""` instead of `"unidentified"`.

3. **Verify the `Select_` component** already passes the empty string correctly and renders the new blank option.

4. **Check the record detail edit form** (`src/routes/letters/$archiveId.tsx` or equivalent) for any `identification_status` default/reset logic and ensure it also allows an empty value.

5. **Typecheck and build** to confirm no regressions.

## Out of scope
- No schema changes; `letters.identification_status` remains `text not null` and an empty string is valid.
- No changes to existing option labels or values beyond adding the blank option.
