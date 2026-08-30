# Primary Person — consolidate the existing design

## Decision (confirmed with user)
- Primary Person stays **singular**: one main subject per record.
- "Francis & Jacqueline" remains a first-class quick pick for the Fran→Jaq correspondence pair.
- For other records (Fran→son, brother, etc.), the single most-central person is chosen as Primary; everyone else is linked via the People panel with roles (author, recipient, subject).
- The photo "needs identification" completeness rule keeps using `primary_person` as-is.

## What changes (small, UI-only)
1. **Quick Entry form (catalog)**: add short helper text under the Primary person field: "The single main subject of this record — add everyone else under People with roles."
2. **Quick picks**: confirm Francis / Jacqueline / "Francis & Jacqueline" / Other quick picks are offered by the Primary person picker in Quick Entry and the record detail page (they are defined in `src/lib/archive.ts`; wire them into the `PersonCombobox` quick-pick list if not already shown there).
3. **No changes to**: the `primary_person` column (stays a single text value), the People links, author/recipient fields, exports, or the completeness/flag logic.

## Technical details
- Files touched: `src/routes/catalog.tsx` (helper text), possibly `src/components/letter/PersonCombobox.tsx` or `src/routes/letters/$archiveId.tsx` to surface the `PRIMARY_PERSONS` quick picks consistently.
- No database migration. No behavior changes to identification-status flagging.

## Verification
- Typecheck/build passes.
- Quick Entry shows the helper text and the four quick picks including "Francis & Jacqueline".
