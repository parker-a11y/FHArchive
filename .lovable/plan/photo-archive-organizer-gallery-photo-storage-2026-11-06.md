# Photo Archive, Organizer, Gallery & Photo Storage

## Where things stand today
- A separate Photos gallery already exists with 53 photographs (front/back files, TIFF masters, 2400px viewing copies, thumbnails, caption, notes, drag order).
- 12 former FH photographs were already moved out of All Records; their FH numbers are kept as legacy references, and the old FH rows are marked "moved to gallery" so All Records excludes them at the query level. No FH-numbered photographs remain in All Records.
- Storage Boxes currently groups FH records by their storage-location text.

So the "conversion" in section 3 is mostly done. What remains is permanent PH numbers, categories, metadata, the organizer, bulk tools, photo boxes, and a new public-feeling gallery.

## What gets built (in order)

**Stage A — Numbering and data (preview first, then your approval)**
1. Add a PH counter and permanent PH number to every photo (PH00001…), assigned automatically on upload with database-safe numbering. Never reused or changed.
2. A "Migration preview" admin screen lists every photo and the PH number it will get (ordered by original upload date, legacy FH number shown alongside), plus anything ambiguous. Nothing is numbered until you click Approve. Re-running is safe; existing PH numbers are kept.
3. Old FH photo links (e.g. /letters/FH0125) redirect to the photo's new page.

**Stage B — Optional details and categories**
- New optional fields: People, Date as written (exact, circa, decade, range — stored as typed, plus a sortable year when it can be read safely), Location, Original Inscription (kept verbatim, shown separately), Information Source, and transcription of the back. Existing caption becomes Subtitle; existing notes become Description/Notes.
- Categories as their own list with many-to-many links, seeded with your 12 starting categories. Duplicate names blocked regardless of capitals/spacing. Category Manager: rename, merge, delete (never deletes photos), reorder, counts.

**Stage C — Batch uploader**
- Drag-and-drop or pick many TIFFs; live counts (total / done / in progress / failed); retry failed files only, without duplicating the ones that succeeded. Each upload belongs to an automatic batch with an optional name. Uses the existing viewing-copy and backup process.

**Stage D — Photo Organizer (admin only)**
- Large photo left, category buttons right (below on mobile), collapsible "Photo Details", autosave, "+ New Category" that assigns to the current photo.
- Working sets: Uncategorized (default), All, Recently Uploaded, by Batch, by Category. Photos you categorize stay in view until you move on.
- Keys: ←/→, Esc, number keys for categories — disabled while typing.

**Stage E — Photo Record List and photo boxes (admin)**
- Compact list with thumbnail, PH, subtitle, categories, upload date, box; search/sort/filter; checkbox, Ctrl/Cmd and Shift range selection, Select All in filter, "57 photographs selected".
- Bulk: add/remove categories, Assign to Box (pick or create PHOTO-003 with optional name and shelf location), clear box with confirmation.
- Storage Boxes page gains a Photo Boxes section: box details, count, PH list, printable label (reusing the existing label printing). Letter boxes stay unchanged.

**Stage F — "The Photo Archive" gallery**
- Ivory and charcoal, justified rows that keep each photo's true shape, lazy loading for thousands of photos, subtle hover showing subtitle/PH.
- Category chips (match any, optional match all, reset) and search across PH, legacy FH, subtitle, people, dates, location, inscription, description, categories.
- Immersive viewer: dark backdrop, arrows, keyboard, swipe, zoom, fullscreen, collapsible info panel showing only filled fields; navigates within the current filter; closing keeps your place; each photo has a stable link (/photos/PH00234). Downloads offer the viewing JPEG only; TIFF masters stay restricted to editors.

Navigation: All Records, Photo Archive, Photo Organizer (admin only). Same sign-in and permissions as today.

## Not included now
- Sleeve/envelope/position tracking inside boxes.
- Linking photos to letters and people (section 14) — the design leaves room for it. Your message was cut off in section 14; send the rest if there is more.

## Technical details
- New tables: `photo_counter`, `photo_categories`, `photo_category_links`, `photo_batches`, `photo_boxes`; new nullable columns on `photos` (`ph_seq`, `ph_id` unique, `batch_id`, `box_id`, `people`, `date_text`, `date_year_start/end`, `location`, `inscription`, `info_source`, `back_transcription`, `original_filename`). All additive; caption/notes reused rather than renamed.
- PH assignment through a security-definer function locking the counter row; backfill function is idempotent and only runs from the admin approval screen.
- Grants + RLS mirror existing `photos` policies (readers read, editors write, admins manage categories/boxes).
- Gallery queries paginate server-side with filters in SQL; viewer state in URL search params so links and back navigation preserve filters.
- Tests: PH formatting/expansion past 5 digits, category name normalization, range selection, date-text parsing.
