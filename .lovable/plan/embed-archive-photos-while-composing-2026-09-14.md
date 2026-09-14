# Embed archive photos while composing

Add an **Insert photo** button to the email composer and to the recap editor, so you can drop any archive image directly into the text you are writing. The photo appears on its own, with the FH/DS number underneath as a clickable caption that opens the full record.

## Picking a photo

Clicking **Insert photo** opens a picker with:

- A **search box** — type an FH or DS number, a title, or a person's name.
- A **Photographs** gallery — every record catalogued as a photograph, newest first, shown as thumbnails.
- Results expand to their individual pages/scans, so you can pick page 1, page 3, an envelope, or a photograph's single image.

Picking an image inserts it at the cursor in the message (or recap body). Inserted photos show as a small chip in the text you can delete like any other text, and the live preview under the recap editor shows the real image.

## How it appears to the reader

- The photo, full width, on its own.
- Under it, the record number (e.g. FH0042) in small caps — clicking it opens that record's public read-only page, the same unlisted link the archive already mints for emailed records.
- Works the same in a sent email, in the shared "Get link" view of that email, and in the recap page on the site.

## Where it works

- **Email from the archive** dialog (All Records, record pages, Ask Francis share).
- **Custom and weekly recap** body editor, and recaps sent by email.

Existing options are untouched: "Include scan images", "Include the envelope scan", and "Include the transcription" still control the record cards below your message. Embedded photos are separate and always appear exactly where you placed them.

## Technical notes

- **Token format** in stored text: `[[photo:FH0042:3]]` (`kind:identifier:page`, page defaults to 1). Plain text, so existing storage columns (`archive_emails.message_body`, `weekly_recaps.body_md`) need no migration.
- **New picker component** `src/components/media/ArchivePhotoPicker.tsx`: search over `letters` (archive_id, title, author/recipient) and `digital_sources`, plus a photograph gallery (`letters.record_type = 'photograph'`); expands a chosen record's `digital_files` / `ds_files` with signed thumbnail previews via existing derivative logic.
- **Resolver** in `src/lib/archive-email.server.ts`: `resolveInlinePhotos(db, ownerId, text)` parses tokens, signs the JPEG derivative (falling back to a viewable master) for a year as `letterImages` already does, and reuses `ensureShareLinksForRefs` for the caption link. Returns `Record<token, { url, identifier, href }>`.
- **Email template** `src/lib/email-templates/archive-record.tsx`: `MessageBody` gains an `inlinePhotos` prop; a block that is only a photo token renders `<Img>` + a `<Link>` caption; tokens inside a paragraph are split out into their own block. New optional `inlinePhotos` prop threaded from `sendArchiveEmail` (and from `getSharedEmailHtml` in `email-share.functions.ts` so shared links match).
- **Recap email** `src/lib/email-templates/weekly-recap.tsx` + `src/lib/recaps/email.server.ts`: same resolver call over `body_md`, same block rendering in `blocksOf`.
- **Web recap view** `src/components/RecapBody.tsx`: renders photo tokens as an `<img>` with a TanStack `Link` caption to `/letters/$archiveId`, signing URLs through a small server fn so the private buckets stay private.
- **Composer wiring**: insert-at-cursor helper for the `Textarea` in `EmailArchiveDialog.tsx` and in `recaps/$weekStart.tsx`.
- No database migration.
