# Remove Audio/Video type + add item-level counts to Dashboard

## 1. Remove Audio / Video

- Drop the "Audio / Video" (`media`) record type from the record-type list and its subtype list in `src/lib/archive.ts`.
- Remove the "Audio / Video" card from the Dashboard's Record categories grid.
- Existing records already saved as `media` (if any) keep their data and still display; the type just no longer appears as a choice. No database change.

## 2. Clarify what an FH record is

An FH record is the accession container (one folder/envelope/grouping). Inside it, the Items / Scans panel holds the individual components — photo, program, agenda, letter pages — and scans attach to those components. So today's "Total archive items" is really a count of FH records, not physical pieces.

## 3. New Dashboard counts

Relabel and add stats:

- **FH records** — total FH accession records (currently labeled "Total archive items").
- **Total items** — count of all child items across every FH record (`letter_items`).
- **Items scanned** — count of child items that have at least one scan attached.
- **Total scans** — total scan images uploaded across the archive.

Existing "Scanned" / "Missing scans" stats stay as record-level counts, relabeled "Records with scans" / "Records missing scans" so the two levels aren't confused.

## Technical notes

- Add a lightweight aggregate query in `src/lib/queries.ts` that pulls `letter_items` (id, letter_id) and `letter_scans` (id, item_id) counts, used by the dashboard via react-query.
- Dashboard computes the four new numbers from those two lists; no schema migration needed.
