# Envelope scans in email + one-tap shareable record links

## Answer to the sharing question

Yes — those `/s/<token>` links are not tied to recaps. Every FH record can have its own public read-only link, created with the **Share** button on the record page. Anyone with the link sees exactly what your recap recipients see (scan, transcription, side-by-side view), no sign-in. Recaps just mint those same links automatically.

What's missing today is convenience: you have to open the record page and use the Share dialog. The plan below adds a one-tap way to get a link from the records list and from the email dialog.

## 1. Include envelope scan in emails

In the email dialog (from All Records or a record page), add a third checkbox next to "Include scan images" and "Include the transcription": **Include the envelope scan**.

- Shown only when at least one selected record is a letter.
- Default: off — envelope pages are left out of the email images.
- On: envelope front/back scans are included alongside the letter pages.

## 2. One-tap share link, no dashboard trip

- On the All Records table, each row's action group gains a **Copy share link** button (link icon). One click creates the record's public link if it doesn't have one, reuses it if it does, and copies the full `https://fharchive.com/s/<token>` URL to the clipboard with a confirmation toast — ready to paste into a text or email.
- The same button appears in the email dialog header, so you can grab a link while composing.
- Records that already have a live link show the link icon filled/highlighted so you can tell at a glance.
- Links stay revocable exactly as today from the record's Share dialog.

## Technical details

**Email envelope option**
- `src/components/letter/EmailArchiveDialog.tsx`: add `includeEnvelope` state (default `false`), the checkbox (rendered when any record is a letter), and pass the flag in the `sendArchiveEmail` payload.
- `src/lib/archive-email.functions.ts`: validate `includeEnvelope?: boolean` and forward into `buildRecords` opts.
- `src/lib/archive-email.server.ts`: `letterImages()` also selects `label` and `original_filename`; skip files matching `isEnvelopePage(label, original_filename)` from `@/lib/transcription` unless `includeEnvelope` is set. Raise the per-record image cap from 4 to 6 when envelopes are included so letter pages aren't displaced.

**Share link shortcut**
- New helper `ensureShareLink(letterId)` — an authenticated server fn reusing the existing `ensureLetterShare` logic in `src/lib/archive-email.server.ts` (reuse enabled record-scope share, otherwise mint a token and flip visibility to `shared`).
- New small component `CopyShareLinkButton.tsx` calling it, then `navigator.clipboard.writeText(shareUrl(token))` from `src/lib/shares.ts`.
- Wire into `src/routes/_authenticated/letters/index.tsx` row actions and `EmailArchiveDialog.tsx`.

## What does not change

- Share security model, token format, revocation, recap sending, `/emails` history, templates.
- No database migration.
