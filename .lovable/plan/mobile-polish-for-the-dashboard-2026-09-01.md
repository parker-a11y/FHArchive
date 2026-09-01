# Mobile polish for the dashboard

A light pass so the archive looks tidy on a phone — no redesign, no behavior changes. Focused mainly on the dashboard tiles, plus a couple of small touch-ups in the shared shell.

## Changes

### 1. Dashboard stat tiles (`src/routes/index.tsx`, `Stat` component)
- On small screens, shrink the big number (`text-3xl` → `text-2xl sm:text-3xl`) and tighten tile padding (`p-4 sm:p-5`) so 2-column tiles don't feel cramped.
- Tile labels: slightly smaller on mobile (`text-[10px] sm:text-xs` equivalent via the existing `field-label` style plus a mobile size override), allow up to 2 lines instead of wrapping awkwardly, so labels like "Needing transcription" or "FFF — Francis File Finds" don't get clipped.
- Smaller icon chip on mobile (`size-7 sm:size-8`).
- Sub-labels ("Click for summary" etc.) hidden or shortened on very small screens so tiles stay a consistent height.
- Long tile labels get shorter mobile-friendly text where helpful (e.g. "FFF — Francis File Finds" → "FFF — Finds" on mobile, "Important quotations" already fits).

### 2. Tile grids
- Main stats grid stays 2 columns on phones but with slightly smaller gap (`gap-3 sm:gap-4`); 3 columns from `sm:` instead of `md:` so small tablets use space better.
- Same treatment for the expanded "Daily summary" and "Record categories" panels.

### 3. Page header (`src/components/AppShell.tsx`, `PageHeader`)
- On the dashboard, the centered logo (size-32/40) pushes content down on mobile — shrink it on small screens (`size-20 sm:size-40`) or hide the center block below `sm:`.
- Make the "ADD NEXT ARCHIVE ITEM" button full-width on mobile so it's an easy thumb target and doesn't wrap oddly next to the title.

### 4. Recently entered list
- Rows currently use fixed-width columns (`w-24`, `w-36`) that squeeze the title on phones. On mobile: hide the origin column and shrink the date column (`hidden sm:table-cell`-style via flex utilities), keep FH ID + status dot + truncated title so each row is one clean line.

### 5. Quick shell check
- Mobile top bar and slide-in nav already exist and work; just verify tap targets and that nothing overflows at 375px width.

## Out of scope
- No changes to desktop layout, navigation structure, data, or any other page's functionality.
- No new components or dependencies.

## Verification
- Build/typecheck.
- View the dashboard at 375px and 768px widths: no truncated/clipped tile text, even tile heights, header and button lay out cleanly, recent-records rows are single-line.
