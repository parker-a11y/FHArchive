# Fix "Fran is a new name" + account for retired numbers 48 and 49

## 1. Why the AI keeps asking to create "Fran"

Confirmed cause: the confirmation dialog that appears before accepting AI suggestions checks a proposed name against the full name of existing people only — an exact text match on the person record's name. "Fran" is stored as a nickname (alias) on "Francis A. Harrington", not as a person named "Fran", so the dialog treats it as brand new and asks to create a record.

The archive's real name matcher (which does know Fran, Jaq, Frank, Mrs. Harrington and the other 30 stored nicknames) only runs *after* that dialog, so no duplicate person is actually created — but you get nagged every time.

Fix: before the dialog decides a person name is new, run it through the same nickname-aware matcher used elsewhere.
- Exact nickname/name hit: treated as existing, no prompt at all.
- Close-but-not-identical: not shown as "new record"; it is passed through to the existing match dialog where you can attach it to a person or create one.
- Genuinely unknown names: prompt as today.

Places, organizations and events keep their current behaviour except that the comparison ignores punctuation and case, so "St. Louis" and "St Louis" stop being offered as separate records.

## 2. Knowing that FH0048 and FH0049 were never really used

Today those two numbers are simply missing, and next year a gap in the sequence looks like a lost record.

Add a small permanent "retired numbers" ledger:
- A new table recording the number, its FH ID, the reason, who retired it and when.
- Seed it with FH0048 and FH0049, reason: "duplicate records created by an error during intake, deleted 2026-09-06".
- An Admin page, "Numbering & gaps", that lists every gap in the FH sequence, shows the explanation where one exists, and flags any unexplained gap so it can be investigated or annotated. Admins can add or edit an explanation from that page.
- The same explanation shows as a small note if someone opens or searches a retired FH ID, instead of a bare "not found".

Records are never renumbered and the counter is not rewound; FH IDs stay permanent.

## Technical notes

- `src/components/ai/ConfirmEntitiesDialog.tsx`: replace the `ilike(column, name)` existence probe for `person` with `findPersonMatches` / `lookupPerson` from `src/lib/person-match.ts` (exact -> allowed, ambiguous -> allowed so `resolvePerson` handles it, new -> prompt). For other kinds, compare on a normalized (lowercase, punctuation-stripped) value.
- Migration: `public.archive_id_retirements` (fh_seq int, archive_id text unique, reason text, retired_by uuid, retired_at, created_at/updated_at) with GRANTs, RLS enabled, read for approved archive users, insert/update for admins only; seed rows for FH0048/FH0049.
- Gap detection query: `generate_series(1, last_seq)` from `archive_counter` left-joined against `letters.fh_seq`.
- New route `src/routes/_authenticated/admin/numbering.tsx` plus an Admin menu entry; not-found handling in the record route reads the ledger.
