# Reimagine the Photograph record

Photographs stop behaving like documents. Intake becomes a short, image-first form, and an existing photo record opens as a picture with a few facts beside it — everything archival stays available but out of the way.

## Photo intake (Catalog Next Item)

When Record type = **Photograph**, the form collapses to a photo card:

```text
FH0031  (next ID)
┌───────────────────────┬──────────────────────────────┐
│  drop photo here      │ Caption / short description  │
│  (preview appears     │ Date  [ ] year only [ ] approx│
│   as soon as dropped) │ People pictured  (multi)     │
│                       │ Place                        │
│                       │ Occasion / event             │
└───────────────────────┴──────────────────────────────┘
  ▸ Photo details (photographer/studio, print size, B&W or color)
  ▸ Writing on the back
  ▸ Storage & filing (folder, box, digital only)
Save & next   Save & open   Save & label
```

- Everything letter-specific disappears: sender/recipient, mailing origin/destination, postal service, forwarded, censor mark, correspondence details, envelope/enclosures, sheets.
- The three grey sections are collapsed by default and remembered per session, so a fast pass only touches the four core fields.
- Dropping an image uploads it to the record on save and shows a live preview while you type, so you can read names and dates straight off the print.
- Photograph records are saved with **Transcription / AI not required** already on; a "this photo has writing" toggle in the Writing-on-the-back section turns it back off.
- Subtype (Portrait, Family, Military…) stays, shown as quick-pick chips rather than a dropdown.

## Photo record page

Opening a Photograph shows a photo-first layout instead of the tabbed catalog form:

- Large image at the top, click to open the existing full-screen viewer (zoom, rotate, next/previous). Front/back prints step through as pages.
- Beside it: caption, date, people pictured, place, occasion — each editable inline.
- Below: collapsed sections for Photo details, Writing on the back, Storage & filing, plus a **Show all archival fields** toggle that reveals the full standard catalog form unchanged.
- The other tabs (People/Places/Keywords, Research, Related, AI Analysis, History) remain, but Transcription is hidden unless the photo is marked as having writing.
- Sticky header, Save changes, Print Folder Label, share/email/delete all behave exactly as they do today.

## New fields captured

Occasion / event, photographer or studio, print size, black-and-white vs color, and writing on the back (reverse inscription). People pictured are stored as real people links, so photos show up on each person's page.

## Technical details

- Migration on `public.letters`: add nullable `photo_occasion text`, `photographer text`, `print_size text`, `photo_medium text`, `photo_back_inscription text`. No changes to existing columns or defaults; existing records unaffected.
- People pictured use `letter_people` with a new `role = 'pictured'` (same pattern as `mentioned`), reusing `PersonMultiSelect`/`linkLetterPeople`; place uses `letter_places` with `role = 'depicted'`.
- New `src/components/photo/PhotoIntakeForm.tsx` rendered by `catalog.tsx` when `record_type === 'photograph'`; shared save path (`create_record` RPC + extras update) is reused, with letter-only params passed as null. Image drop reuses the existing `DigitizationPanel` upload + `generateDerivatives` flow after the record ID exists.
- New `src/components/photo/PhotoRecordView.tsx` used by `letters/$archiveId.tsx` for photograph records; it wraps the existing `MediaLightbox`, form state, and `save()` handler already in that route — no duplicate save logic. "Show all archival fields" renders the current catalog grid as-is.
- `search_letters`, exports, backup and the research index pick the new columns up as ordinary letter columns; add them to the record's research-index body text and to AI analysis context so photo descriptions can use occasion/photographer.
- Auto-skip transcription: photograph intake writes `transcription_status = 'not_required'` unless the has-writing toggle is set.
