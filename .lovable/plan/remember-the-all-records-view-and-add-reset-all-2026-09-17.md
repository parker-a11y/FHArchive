# Remember the All Records view, and add "Reset all"

## Goal
When you leave the All Records table and come back, it should look exactly as you left it: same filters, same quick-filter chips ("Needs attention", "Starred", etc.), same sort order, same page, same column layout. Plus one clearly labelled button that wipes everything back to the default view.

## What changes

1. The view remembers itself
   - Everything in the filter bar is saved as you change it: search text, record type, period, transcription/ID/date/digitization status, health, tones, postage, forwarded, correspondence fields, the Views buttons (All / Undated / Unidentified photos), and the quick-filter chips.
   - Display choices are saved too: sort column and direction, current page, compact density, hidden columns, whether the Correspondence section is expanded. Column widths already persist and keep working.
   - Saved per browser, so it survives navigating away and coming back as well as a reload.
   - A link into the table that carries its own filters (for example from a dashboard tile) still wins over the saved state, so those links keep working as they do today.

2. "Reset all" button
   - Replaces the existing "Reset filters" button with "Reset all", in the same spot, keeping the count badge.
   - Clears all filters and chips, returns sort to FH record number ascending, goes back to the default page, clears any ticked record selections, turns off compact mode, restores hidden columns and column widths, and clears the saved state so the next visit starts clean.
   - Enabled whenever anything is off-default (not just filters), so it can always undo a stray sort or selection.

## Out of scope
- No change to what the filters actually return, to the table columns, or to any record data.
- Record selections are not remembered across pages (they are cleared on reset and otherwise behave as today).

## Technical notes
- Work is confined to `src/routes/_authenticated/letters/index.tsx`.
- Add a single versioned `localStorage` key (e.g. `letters_view_state_v1`) holding one serialised state object; read it once on mount before the existing URL-search sync effect, and write it on change (debounced) via an effect.
- Precedence on mount: URL search params (existing `Route.useSearch()` values) override stored values for the keys they provide; otherwise stored values apply; otherwise current defaults.
- Keep the existing `pageInitialized` ref behaviour (default to last page) only when no stored page exists.
- Extend `resetFilters()` into `resetAll()`: current resets plus `setSelected(new Map())`, `setCompact(false)`, `setHidden([])`, `setWidths({})`, remove `letters_col_widths` and the new state key, then the existing `navigate({ to: "/letters", search: () => ({}) })`.
- Extend the button's disabled condition from `activeFilterCount === 0` to also account for non-default sort, compact, hidden columns, and selections.
