# Email From the Archive

Build the sending feature on top of the existing archive so it works the moment `notify.fharchive.com` finishes verifying.

## What you'll be able to do

- From any FH record or Digital Source, click **Email from archive**.
- Pick one or more recipients: type an address, or choose from saved archive contacts (autocomplete, most recently used first).
- Choose which records to include — the current one, or add more by FH / DS number.
- Write a subject, an optional header title/subtitle, and a message.
- Choose what the email shows for each record: title, date, people/places, short summary, and (optional) transcription.
- Preview the email exactly as it will arrive, then send.

## Images and scans

Lovable's email delivery does not support file attachments, so scans go out as links, not as attached files:

- For each selected record, the email includes its scan images inline where possible and a **View in archive** button.
- The button uses the existing public share-link system (the same tokens behind `/s/<token>` and `/d/<token>`), created automatically for the records you email and revocable later from the record's share controls.
- Nothing becomes public that you didn't include in an email; links can be turned off at any time.

If you'd rather have real JPG attachments, that requires sending through your own Resend account instead — say the word and I'll wire that path instead.

## Sent history

- A **Sent email** page lists every archive email: date, subject, recipients, records included, and delivery status.
- Each row expands to show the message body and links to the records.
- Delivery problems (bounces, unsubscribes) are reflected in the status.

## Technical notes

- Scaffold Lovable app-email templates; add an `archive-record` React Email template styled to match the archive (cream/sage/amber, serif headings).
- New server function `sendArchiveEmail` (admin-only, via `requireSupabaseAuth` + `is_admin`): validates input, ensures/creates share tokens for the selected records, renders and sends through `sendTemplateEmail` with an idempotency key, then writes `archive_emails`, `archive_email_records`, and upserts `archive_contacts` (`last_used_at`).
- Existing tables are reused as-is; no schema migration needed. `archive_email_attachments` stays unused under the link-based approach.
- New UI: `EmailArchiveDialog.tsx` (composer + preview) wired into `letters/$archiveId.tsx` and `sources/$dsId.tsx`, plus a `/emails` route for history, linked in the sidebar (admin only).
- Add the email events receiver route so bounces/complaints/unsubscribes update the stored status.
- Sends fail with a clear "domain not verified yet" message until DNS propagates; everything else is testable now.
