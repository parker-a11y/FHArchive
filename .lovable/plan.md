# Important Quotations

A new dashboard tile plus a running, date-sorted table of every notable quotation the AI analysis has surfaced across the archive.

## Where the quotes come from

AI analysis already stores a "Important quotations" block per record (one quote per line). Today there are 12 such blocks — 11 reviewed/accepted, 1 still pending — covering FH0001–FH0012. Nothing new needs to be generated: the new page splits those blocks into individual quotes and lists them.

Reviewed (accepted) quotations show by default; a "Include unreviewed" toggle reveals pending ones, marked with a small "unreviewed" chip so you can tell them apart.

## Dashboard tile

- New tile "Important quotations" with the total quote count, styled like the other tiles.
- Clicking it opens the new `/quotations` page.

## Quotations page

- One row per quote: the quote text, the record's date, FH number, and title/author→recipient.
- Sorted by record date (newest first by default, toggle to oldest first). Records with no date group at the end under "Undated".
- Search box filters by quote text, FH number, or person.
- Clicking a row opens the quote detail.

## Quote detail

A dialog showing:
- The full quote.
- The scan page the quote came from: the page image, found by matching the quote text against each page's transcription. When no page matches (quote drawn from the record-level transcription), the record's first scan is shown instead with a note.
- The surrounding transcription text with the quote highlighted.
- Buttons: "Open record" and "Open transcription at this quote" (uses the existing highlight-jump behaviour).

## Technical notes

- No schema change. Reads `ai_suggestions` where `field_key = 'quotations'`, joined to `letters` for date/identity; quote strings are derived by splitting content on newlines and trimming quote marks/bullets.
- New route `src/routes/_authenticated/quotations.tsx` with its own head metadata; new query helper in `src/lib/queries.ts` (or a small `src/lib/quotations.ts`).
- Page matching uses `scan_transcriptions` (verified text preferred, then AI text) with normalized-whitespace substring matching; scan images come from the existing derivative/thumbnail lookup used by the digitization panel.
- Tile added to the existing stats grid in `src/routes/_authenticated/index.tsx`; visible to guests as read-only like other tiles.
- Deep links reuse `/letters/$archiveId?tab=transcription&hl=<quote>`.
