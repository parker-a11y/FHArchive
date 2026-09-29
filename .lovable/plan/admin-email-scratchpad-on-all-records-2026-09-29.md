# Admin email scratchpad on All Records

## What you'll see
- A third round icon (notepad) right after the Link icon on every row of All Records — shown only to admins.
- Grey when empty; turns amber/gold with a filled look when the record has a note.
- Clicking opens a small window with a text editor (same editor as emails — bold, italic, lists, paste with automatic quote formatting). Type or paste notes for future emails, then Save. A Clear button empties it.
- Hovering the icon shows the first line of the note.

## Privacy
- Notes are stored in a separate admin-only place, so archivists, guests and shared links can never read them (not just hidden in the page).

## Technical details
- Migration: new table `email_scratchpads` (letter_id PK → letters on delete cascade, body text, updated_at, updated_by). GRANT to authenticated/service_role; RLS: all actions only when `public.is_admin(auth.uid())`. updated_at trigger.
- New `src/components/letter/EmailScratchpadButton.tsx`: Dialog + `RichTextEditor`; upsert/delete via browser client; invalidates query `["email-scratchpads"]`.
- `letters/index.tsx`: admin-only query loading all scratchpad rows (letter_id, body) into a map; render the button after `CopyShareLinkButton` (line ~1453), coloured via existing tone tokens when body is non-empty.
