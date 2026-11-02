# Photo Gallery (separate from FH records)

## What you'll get
- A new **Photos** page in the sidebar: a simple grid of photo thumbnails, newest first, with a search box (searches caption + notes).
- **New Photo** button opens one small dialog:
  - Front photo (drag/drop or pick) — required
  - Back photo — optional
  - Caption — optional
  - Notes — optional (date, people, research, anything)
  - Save. That's it. No FH number, no boxes, no AI, no labels.
- TIFFs get a viewable preview automatically (same as the bucket fix).
- Clicking a photo opens a viewer: large front, flip to back, caption and notes editable in place, Delete.
- Optional: drag several photos onto the page to create one gallery photo each (caption/notes blank, fill later). This replaces the separate Unassigned Photos bucket.

## Moving existing photos
- The 12 FH records marked Photograph are copied into the gallery: front/back images, title becomes Caption, and the old details (date, writing on back, people, place, box, notes) are combined into Notes so nothing is lost.
- The 9 photos waiting in the Unassigned bucket also become gallery photos.
- After copying, the old FH photo records are hidden from All Records (kept, not deleted, so their FH numbers and history stay safe and links still work). Their FH numbers are retired, not reused.
- Quick Entry no longer offers Photograph; the Unassigned Photos page is removed from the sidebar.

## Questions resolved by default (tell me if different)
- Gallery is visible to the same people who can see the archive; only editors can add/edit/delete.
- Photos are not included in emails/recaps for now.

## Technical details
- New table `photos` (id, front_path, back_path, front_thumb_path, back_thumb_path, caption, notes, created_by, created_at, updated_at, legacy_letter_id). Grants + RLS using `can_read_archive` / `can_edit_archive`.
- Files in existing private `scans` bucket under `photos/`; signed URLs; reuse TIFF preview helper.
- One-time conversion via an editor-only server function (idempotent through `legacy_letter_id`); old letters flagged hidden via existing archived/retirement mechanism, not deleted.
- New route `/photos`; remove Photograph from Quick Entry record types; retire photo-inbox route link.
- Small test for the notes-merging rule used in conversion.
