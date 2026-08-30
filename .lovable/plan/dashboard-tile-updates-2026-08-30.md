# Dashboard tile updates

## What "Cataloged" means (answer to your question)

The **Cataloged** tile counts FH records that have basic catalog information filled in — specifically, a record counts as "cataloged" if it has an **author**, a **recipient**, **or** a **date**. It's meant to answer: "how many records have I actually described vs. just created?" Clicking it opens All Records filtered to those records. Records with none of those three fields filled (essentially stubs created via Quick Entry) are the ones *not* yet cataloged.

## Changes to make (all in `src/routes/index.tsx`)

### 1. Remove the "Sources with file copies" tile

- Delete the separate "Sources with file copies" stat tile from the stats grid.
- Move that number into the **Digital sources** tile as a small sub-label under the main count, e.g. `14 digital sources` with a secondary line `9 with file copies`.
- Clicking the tile still opens the Digital Sources page.

### 2. Clarify "Cataloged"

- Add a small helper text/tooltip on the Cataloged tile: "Records with an author, recipient, or date filled in" so the meaning is visible without asking.

### 3. Make record category tiles fully automatic for future record types

Today the tiles are mostly data-driven, but with two gaps: unknown record types found in records are lumped into "Other", and newly added custom types only appear once they have a record. Fix both:

- Any record type that exists in the type-options list (built-in **or** user-created) always gets a tile, even at count 0, so new types appear immediately.
- Any record type value found in actual records that isn't in the options list gets its own tile with its raw value as the label and a fallback icon/color — no more silent bucketing into "Other".
- Keep the existing style map for known types; new/custom types get the neutral fallback styling.

No database changes. No other pages affected.

## Verification

- Typecheck + build.
- Load the dashboard, confirm: "Sources with file copies" tile is gone, Digital sources tile shows the sub-count, all category tiles (including custom ones at 0) render, and clicking tiles still navigates to the filtered All Records view.
