# Make recap record links viewable by anyone

## Goal
Today the FH/DS numbers in a weekly recap link into the archive itself (`/letters/FH0042`), so anyone without an approved account hits the sign-in wall. Recipients of an emailed recap should be able to click a record and read it immediately — no account, no login.

The archive already has exactly the right mechanism: unlisted share links (`/s/<token>` for FH records, `/d/<token>` for digital sources) that serve a read-only, whitelisted view with signed image URLs. "Email From the Archive" already mints these automatically. The recap email should do the same.

## What changes

1. When you press **Email recap**, every FH/DS number referenced in that recap gets an unlisted share link minted (or reused, if one already exists) — the same helper the archive email already uses. No new sharing concept, no new tables.

2. In the emailed recap, those record numbers become clickable links to the public view instead of plain text. The "Related records" strip at the bottom becomes a row of links too.

3. A checkbox on the Email recap dialog: **"Let recipients open linked records without signing in"** — on by default. Turned off, the email behaves exactly as it does today (plain record numbers).

4. A second checkbox, off by default: **"Include transcriptions in shared records"** — matches the existing archive-email option so you control how much text leaves the archive.

5. On the recap page inside the archive, links keep going to the full internal record pages (signed-in members always get the richer view). Nothing changes for admins/archivists/guests browsing in-app.

6. The recap page gets a small **Sharing** line listing which records currently have public links, with the ability to turn any of them off later — so a link sent last month can be revoked.

## Notes on safety
- Share tokens are 32 random hex characters — unguessable and never sequential.
- The public view exposes only whitelisted fields; archival master TIFFs are never served, only web copies through short-lived signed URLs.
- Records shared this way flip to "Shared by link" visibility so they are visible in your normal sharing audit, and every view is counted.
- Pages are marked no-index so search engines never pick them up.

## Technical notes
- Reuse `ensureLetterShare` / `ensureSourceShare` from `src/lib/archive-email.server.ts` — extract them into a small shared server helper so both the archive email and `src/lib/recaps/email.server.ts` use one implementation.
- In `sendRecapEmail`: scan `recap.body_md` + `related_ids` for `FH\d{3,}` / `DS-?\d{3,}`, resolve them to `letters.id` / `digital_sources.id`, mint tokens, and pass a `{ [ref]: url }` map into `templateData`.
- `src/lib/email-templates/weekly-recap.tsx`: in `blocksOf` rendering, split inline text on the FH/DS pattern and wrap matches in `<Link>` when the map has that ref; render `relatedIds` as links likewise. Falls back to plain text when linking is off.
- `src/lib/recaps.functions.ts` `emailWeeklyRecapFn`: add `publicLinks: boolean` and `includeTranscription: boolean` to the input validator; admin-only check stays.
- Recap page email dialog (`src/routes/_authenticated/recaps/$weekStart.tsx`): two checkboxes wired to those flags.
- `RecapBody.tsx` is unchanged — in-app links stay internal.
- No database migration needed; `record_shares` and `source_shares` already exist.
