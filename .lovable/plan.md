# Short titles for personal letters

Add a one-click way to generate a consistent short title for personal letters, and bring existing personal letters onto the same convention.

## The naming convention

```text
Letter from Fran to Jaq - 1944-12-03
```

- Francis A. Harrington always renders as **Fran**; Jaquelyn Harrington always renders as **Jaq** (matched through their existing aliases, so "Francis", "Jacqueline Harrington", etc. all resolve). Everyone else keeps their full canonical name.
- Date uses the record's normalized date, at whatever precision is known:
  - exact day: `- 1944-12-03`
  - month only: `- 1944-12`
  - year only: `- 1944`
  - no date at all: no suffix, just `Letter from Fran to Jaq`
- Missing From or To reads as `unknown` in that slot (`Letter from Fran to unknown - 1944-12`).

## Create Short Title button

A small **Create Short Title** button sits next to the Title / short description field, shown only for personal letters (record type Letter, subtype Personal letter):

- On the record edit page (`/letters/FH####`)
- On the Quick Entry / catalog form

Clicking it fills the Title field with the generated string. It never saves on its own — the title lands in the form and you save as usual, so you can tweak it first. If a title already exists, clicking overwrites it (you can still undo by not saving).

## Backfill of existing records

A one-time data update rewrites the title of every personal letter (record type Letter + subtype Personal letter) to the new convention. This cleans up the current mix:

- `Letter from Fran to Jaq December 14` becomes `Letter from Fran to Jaq - 1944-12-14`
- `Letter from Fran to Jaq 12-3-1944` becomes `Letter from Fran to Jaq - 1944-12-03`
- Bare `Letter from Fran to Jaq` gets its date appended

Records outside that scope are untouched — FH0001's circular letter, receipts, photographs, Navy documents and publications keep their titles.

## Technical notes

- New helper `src/lib/short-title.ts` exports `shortLetterTitle({ author, recipient, normalized_date, date_precision })` plus the Fran/Jaq nickname map, so UI and backfill share one implementation.
- Nickname resolution: case/punctuation-insensitive match against `people.name` and `person_aliases.alias` for the two Harrington records; the UI helper uses a small static map to avoid an extra fetch on every keystroke.
- Button rendered in `src/routes/_authenticated/letters/$archiveId.tsx` and `src/routes/_authenticated/catalog.tsx`, gated on `record_type === "letter" && subtype === "Personal letter"`.
- Backfill runs as a SQL data update over `letters` with the same formatting rules (`to_char` on `normalized_date` keyed off `date_precision`), scoped to personal letters only.
