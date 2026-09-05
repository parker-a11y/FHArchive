# Fix: On This Date links not visible on mobile

## Root cause (confirmed in code)

1. **Record detail page** (`src/routes/_authenticated/letters/$archiveId.tsx:359`): the header row containing the Date field is marked `hidden sm:flex` — it is intentionally not rendered on mobile at all. So the DateLink and "What was happening this day?" link never appear on phones.
2. **All Records list** (`src/routes/_authenticated/letters/index.tsx:989`): the Date column renders plain `displayDate(l)` text — it was never wrapped in `DateLink`.
3. **Search results and Quotations** (`search.tsx`, `quotations.tsx`): dates are plain text, never wired to DateLink.

Only the Timeline page and the desktop record header currently have working date links.

## Changes

### 1. Record detail header — show the date on mobile
- Change the `hidden sm:flex` metadata row in `$archiveId.tsx` to render on all sizes (or add a compact mobile-only date line just under the title that includes the `DateLink` + "What was happening this day?" action).
- Keep the sticky-header layout compact on mobile so it doesn't eat screen space.

### 2. All Records list — link the Date column
- In the `cellValue`/render path for the Date column, wrap the displayed date in `DateLink` (using `l.normalized_date`). Guard so inline-editing cells and non-date columns are unaffected.

### 3. Search results and Quotations
- Wrap the displayed record dates in `DateLink` in `search.tsx` (record card metadata) and `quotations.tsx` (both quote list date displays).

### 4. Verify
- Typecheck/build.
- Manual check at mobile viewport: record page header shows a clickable date; All Records, Search, Quotations dates open the On This Date page.

## Out of scope
- No changes to the On This Date page itself, generation logic, or admin review area.
