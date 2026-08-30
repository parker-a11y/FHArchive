Remove the Reviewed dashboard tile

Goal
- Remove the "Reviewed" tile from the Archive Dashboard because the review_status workflow is no longer useful as a top-level metric.

Changes
1. In `src/routes/index.tsx`, remove the Reviewed stat object from the `stats` array.
2. Remove the `Eye` import if it becomes unused.
3. Leave the underlying `review_status` field, record form picker, and filtering untouched.

Verification
- Run typecheck and confirm the dashboard still renders the remaining tiles.
