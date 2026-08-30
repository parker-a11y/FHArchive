# Fix the Record categories count on the Dashboard

## What's happening

The dashboard header count (6) is the true number of FH records. The "Record categories" tiles below it only add up to 3 because that section renders a hardcoded list of ten categories that was written before newer record types existed.

Your six records are:

```text
Letter / Correspondence      1   shown
Financial Record             2   shown
Navy Document (custom)       1   NOT shown
Personal Documents / Papers  1   NOT shown
Publication / Printed        1   NOT shown
```

Three records belong to categories that have no tile, so they silently disappear from that section. Nothing is wrong with the data — only the dashboard's fixed tile list.

## The fix

Build the Record categories tiles from real data instead of a hardcoded list:

1. Use the full record-type list (including your custom types saved in the categories manager, such as Navy Document) as the source of tiles.
2. Show a tile for every category that has at least one record, so the tiles always sum to the total record count.
3. Keep the standard core categories visible even at zero (Letters, Photographs, Military, Government, Personal / Family, Newspaper, Financial, Programs, Artifacts, Other) so the dashboard doesn't look empty early on.
4. Anything not matching a known type falls into "Other" rather than vanishing.
5. Each tile keeps its existing click-through to All Records filtered by that type.

## Technical details

- File: `src/routes/index.tsx`, the "Record categories" block (currently a hardcoded array of ten `{value,label,tone,icon}` entries).
- Source of categories: `RECORD_TYPES` from `src/lib/archive.ts` merged with owner custom types from `record_categories` (kind = `record_type`), via the existing helper in `src/lib/categories.ts`.
- Tone/icon: keep the current mapping for known values; assign a default icon/tone (Box / indigo) to types without one, including custom types.
- Counting: group `letters` by `record_type` once, then render tiles from that map; verify the rendered tile values sum to the total record count.
- No schema or data changes.
