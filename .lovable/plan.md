# Tighten data entry and upload

Goal: fewer fields on screen, fewer clicks per record, nothing lost. Nothing is deleted from the database — fields that leave the form keep their stored values and stay visible on the record detail page.

## What the data says (all 6 records today)

- Never used: legacy storage note (0), location notes (0), physical condition (0), notes (0), enclosures (0), envelope (0), end date (1).
- Always the same value: original / copy = "original" (6/6), storage type = "file jacket" (6/6), period = "wartime" (6/6).
- Barely used: date as written (4), destination (1), sheets (2), tone (1), original order notes (2).
- Date status and Certainty overlap: the Year-only / Month-year checkboxes already set date status, so the separate "Date status" select is a duplicate control.

## Quick Entry: proposed layout

Visible by default (the fast path):
- Record type, Subtype, Title / short description
- Date (with the Year-only / Month-year checkboxes)
- From / To (letters only), Origin
- Primary person, Mentions
- Folder / jacket (already auto-filled with the FH number)

Moved into a collapsed "More details" section, remembered open/closed between entries:
- Certainty, Period, Identification status, Original / copy, Storage type, Location notes, Legacy storage note, End date, Date as written, Destination, Pages / sheets, Tone, Envelope / Enclosures, Source container + original order notes, Notes

Removed from the form:
- "Date status" select (the checkboxes drive it)
- Helper paragraphs under Primary person, Mentions and Date — keep only the short "blank = undated" hint

Also:
- Sticky defaults: record type, subtype, period, storage type, original/copy, source container and primary person carry over from the last saved record in the session, so a run of similar items is type-once.
- Keyboard: Cmd/Ctrl+Enter = Save & create next; focus returns to Title after each save.

## Upload: proposed changes

- After files are dropped, derivative generation starts automatically instead of waiting for "Confirm Upload Complete". The button stays only as a retry when something failed or new masters were added.
- Collapse the five stat boxes (Processing status, Masters, Expected, Viewing JPGs, Thumbnails) into one line: "8 masters · 8 JPGs · 8 thumbnails" and only expand into detail when something is off.
- Drop the digitization status dropdown from the header; the status is derived from the files (none / in progress / complete), with a single "Mark complete anyway" action for the override case.
- Keep untouched: archival masters are never altered, filename mismatch warnings, expected-count warning, per-scan rename/transcribe/download/delete.

## Technical notes

- Files touched: `src/routes/catalog.tsx` (layout, collapsed section, sticky defaults, shortcut), `src/components/letter/DigitizationPanel.tsx` (auto-generate, condensed summary, derived status).
- No schema migration. `date_precision`, `storage_container`, `physical_condition` etc. stay in the database and on the record detail page.
- Sticky defaults live in component state plus `localStorage`, so they survive a page refresh but never overwrite a saved record.
