# Side-by-side transcription for recap email links

## Goal
Anyone opening a record link from a weekly recap email — including emails sent months ago — sees a big, obvious button to read the transcription next to the letter scan.

## Key insight
Recap emails link to the public shared-record page (`/s/<token>`). Emails already sent cannot be changed, but that page is live — improving it instantly upgrades every link in every previously sent email. No resending needed.

## Changes

### 1. Shared record page (`src/routes/s.$token.tsx`)
- Replace the small "Show transcription" text toggle with a prominent, clearly visible button: **"Read transcription alongside the letter"** — solid primary styling, larger size, document icon, placed in the header next to the record title/date.
- Clicking it switches the viewer to a **side-by-side layout**: scan on the left, transcription on the right in a matching-height scrollable panel, so the reader can follow the letter while reading the text. Page navigation (Previous/Next, thumbnails) stays with the scan.
- Clicking again returns to the current single-column layout. On small phone screens the two panes stack (scan on top, transcription below) since true side-by-side doesn't fit.
- If a shared record has no transcription, no button appears (unchanged).

### 2. Future recap emails (`src/lib/email-templates/weekly-recap.tsx`)
- Make the record links in future emails clearer: keep the FH/DS numbers linked, and in the "Records in this recap" section append a short "view scan & transcription" hint so new recipients know what they'll get. (Old emails keep their original text — only the destination page changes for them.)

### 3. Safety
- No changes to share-link security, transcription data, or the recap sending flow. The shared page already hides transcription when a share was created without it — that setting is still respected.

## Technical details
- Files touched: `src/routes/s.$token.tsx` (layout + button), `src/lib/email-templates/weekly-recap.tsx` (link hint for future sends).
- Side-by-side uses a responsive grid (`lg:grid-cols-2`) with a sticky transcription panel; transcription already arrives via `getSharedRecord` and renders through `FfnText` (Francis File Notes stay highlighted).
- Verify: typecheck, build, then open an existing share link and confirm the button and side-by-side view work.
