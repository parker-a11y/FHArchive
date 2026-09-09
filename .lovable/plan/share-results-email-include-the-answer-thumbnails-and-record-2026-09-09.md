# Share Results email: include the answer, thumbnails, and record links

## What you reported

Sharing an Ask Francis result emails the question but not the answer. You also want each cited record to show a small image and a link anyone can open.

## What the code does today

- The Share Results button builds a message containing the question, the answer, caveats, confidence, the list of cited records, and any outside sources, and puts it in the email dialog's Message box.
- The email itself renders that message as paragraphs, then one card per cited record with up to four full-size scan images and a "View in the archive" button pointing at an unlisted share link.

Because the wiring for the answer text already exists, the cause of the missing answer is not yet confirmed. Likely suspects to check first: the message is trimmed or emptied before sending, the answer text is dropped by the email's paragraph/markdown rendering (for example headings, bullets, or citation markers), or the 10,000-character message limit cuts it.

## Plan

1. Confirm the cause
   - Reproduce a share from a real Ask Francis answer and inspect what is actually stored in the sent-email record and delivery logs.
   - Render the email template locally with a real answer to see whether the answer paragraphs survive rendering.
   - Fix the specific defect found rather than guessing.

2. Make the answer a first-class part of the email
   - Instead of packing question, answer, caveats, confidence, and sources into one free-text blob, pass them as distinct pieces to the email so the answer can never be swallowed by message formatting.
   - The email shows: the question, the answer body, caveats and confidence, outside sources, then the record cards.
   - Keep the Message box editable so a personal note can still be added above the answer.
   - Raise or remove the practical truncation point for the answer so long research answers arrive whole.

3. Thumbnails and record links
   - Each cited record shows one small thumbnail (first page) at a constrained width instead of up to four full-width scans, so the email stays light with many citations.
   - The thumbnail itself is clickable and opens the same read-only archive page as the button beneath it.
   - Record numbers written in the answer text continue to become clickable links.
   - Records that are not shareable simply show no link, never a broken one.

## Technical notes

- Files: `src/routes/_authenticated/ask.tsx` (share payload), `src/components/letter/EmailArchiveDialog.tsx` (optional structured research fields), `src/lib/archive-email.functions.ts` (validator + template data), `src/lib/email-templates/archive-record.tsx` (research block, thumbnail sizing, linked images), `src/lib/archive-email.server.ts` (thumbnail-only image selection when sharing research).
- Reuse existing unlisted share-token generation; no new tables, policies, or storage changes.
- Verify with a typecheck, a template preview render, and one real test send.
