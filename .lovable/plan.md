# Why the envelope scan was left out of the email

## What I found

Your email for FH0173 had everything it needed: the record has four letter pages plus an "Envelope Front" scan, all with finished web-ready copies. Checking the envelope box did pass through correctly.

The email layout itself is the problem. It only ever prints the **first four images** of a record, no matter how many were prepared. The envelope is the fifth scan in reading order, so it is cut off every time a letter has four or more pages. On a short letter (three pages or fewer) the envelope would have shown up — which is why this looked inconsistent.

## The fix

1. Stop the email layout from silently trimming images. It prints every image the record supplies (one thumbnail when a research share is sent, unchanged).
2. Make the envelope a guaranteed slot rather than a leftover one. When "Include the envelope scan" is ticked, the record keeps up to four letter pages **plus** its envelope front and back, so a long letter no longer pushes the envelope out.
3. When the box is not ticked, nothing changes: up to four letter pages, no envelope.

This applies everywhere the same email body is used — sending from All Records, from a record page, and the shareable "Get link" view of a sent email.

## Technical details

- `src/lib/email-templates/archive-record.tsx`: the `slice(0, thumbnails ? 1 : 4)` on `r.images` drops images the server already selected. Keep the single-image slice for `thumbnails`, otherwise render the full array.
- `src/lib/archive-email.server.ts` (`letterImages`): instead of one flat `slice(0, limit)` over all files, partition by `isEnvelopePage` — take up to 4 non-envelope pages, then append up to 2 envelope pages when `includeEnvelope` is set. Drop the ad-hoc 4-vs-6 `imageLimit` in `buildRecords` in favour of these explicit caps.
- No database, storage, or sharing changes; signed-URL handling stays as is.

## Verification

Re-send FH0173 with the envelope box ticked and confirm five images arrive, envelope last.
