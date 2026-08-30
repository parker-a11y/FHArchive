# FFF — Francis File Find

Rebrand the current "Of extreme interest" star system into a named feature: **FFF — Francis File Find**, the archive's headline highlights. Same underlying flag, new identity, a dedicated highlights page, and a small badge logo used on archive notes and emails.

## What changes for you

- The star becomes the **FFF** mark. Marking a record or digital source flags it as a Francis File Find.
- Dashboard tile renames from "Of extreme interest" to **Francis File Finds (FFF)** with the new badge, and links to a dedicated highlights page instead of a filtered list.
- New page **/fff** — a headline gallery of every FFF record and digital source, newest first, showing FH number, title, date, people, and a thumbnail when a scan exists. Sortable by date added / record date / FH number, with a records-vs-sources filter. Guests can view it (read-only) since they already see the flag.
- Archive notes created when you mark an FFF get FFF wording and the badge in the notes ledger, replacing "Of extreme interest".
- Emails that include an FFF record show the small FFF badge next to the record header.

## Logo

Generate a small square badge (transparent PNG, ~512px, plus the same asset used at 28–40px):
monogram **FFF** in a period-appropriate serif inside a thin ring, aged-ink navy/amber palette matching the existing Francis Files ship mark. Stored at `src/assets/fff-badge.png` and referenced in the UI; for email, the same file is published to the existing CDN asset path pattern used by `email-logo.png` so mail clients can load it.

## Technical notes

- No schema change — keeps `letters.starred` and `digital_sources.starred`, plus `dashboard stats` fields `starred_records` / `starred_sources`.
- `src/components/StarToggle.tsx`: rename user-facing strings to FFF ("Mark as Francis File Find", "FFF"), swap the lucide `Star` glyph for the badge asset at small sizes (keep the filled/unfilled states), retitle `StarNoteDialog` to "Post an FFF note?" with prefilled body "New Francis File Find: {label}." Component/prop names stay stable to limit churn.
- New route `src/routes/_authenticated/fff.tsx`: queries starred letters (`listLetters`-style select filtered `starred = true`) and starred digital sources, combined and sorted client-side; reuses existing card/table styling and `AdminOnly` is NOT applied (guests read-only).
- `src/routes/_authenticated/index.tsx`: tile label/icon/`to: "/fff"`.
- `src/routes/_authenticated/letters/index.tsx` and `sources/*`: label/tooltip text updates only.
- `src/components/ArchiveNotes.tsx`: render the FFF badge on notes whose title starts with the FFF marker.
- `src/lib/email-templates/archive-record.tsx`: optional `isFff` prop renders a badge row; passed from the record assembly that already builds the email payload.
- Route `head()` metadata for `/fff` with its own title/description.
