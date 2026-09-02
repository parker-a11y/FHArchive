# Envelope Review

A focused, admin-only workspace for going back through letters that already have envelope scans and filling in the mailing/postal details quickly — without touching the normal intake flow.

## Where it lives

New sidebar item **Envelope Review** (admin only), placed near Work Queues. Opens `/envelopes`.

## The screen

Left: a compact list of every record that has at least one scan labeled *Envelope Front* / *Envelope Back* (currently 11 records). Each row shows FH ID, title/date, and a small "complete / needs review" marker based on whether postal fields are filled. A filter toggle for "Needs review only".

Right: the review pane for the selected record.

```text
[ ‹ Prev ]   FH0007 — 3 of 11   [ Next › ]
+-----------------------------+  Mailing origin      [____________]
|                             |  Mailing destination [____________]
|      ENVELOPE IMAGE         |  Postal service      [ dropdown  ]
|      (large viewer)         |  [ ] Forwarded
|                             |      Forwarded to    [____________]
+-----------------------------+  Postal notes        [____________]
   [ Front ] [ Back ]            [ Save & Next ]  [ Save ]
```

- Large envelope viewer with **Front / Back** toggle buttons (keyboard: left/right arrows switch record, `F`/`B` flip sides). Rotate and zoom-to-open-full-size reuse the existing scan viewer behavior.
- Only the envelope-relevant fields are shown: Mailing origin, Mailing destination, Postal service / postage (with + Add New), Forwarded checkbox revealing Forwarded to, and Postal notes.
- **Save** writes just those fields; **Save & Next** saves and advances to the next record in the list. Prev/Next arrows at the top move sequentially and warn on unsaved changes.
- Edits go through the same update path as the letter edit form, so edit history is recorded as usual.

## Scope

Read/write limited to the postal fields already added to letter records. No changes to intake, transcription, scans, AI analysis, or any other page. Guests and archivists do not see the menu item; the page is admin-gated like other admin pages.

## Technical notes

- New route `src/routes/_authenticated/envelopes.tsx`, wrapped in `AdminOnly`.
- Query: `digital_files` filtered to labels matching `envelope` (case-insensitive), joined to their `letters` rows; grouped per record with front/back signed URLs via the existing `fetchDigitalFiles` / `signedScanUrl` helpers.
- Form reuses `src/components/letter/PostalFields.tsx` plus two text inputs for origin/destination, so field behavior stays identical to the letter edit form.
- Nav entry added to `NAV` in `src/components/AppShell.tsx` with `adminOnly: true`.
