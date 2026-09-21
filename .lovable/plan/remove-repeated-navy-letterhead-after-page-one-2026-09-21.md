# Remove repeated Navy letterhead after page one

## What will change

- Keep the complete letterhead in the first transcribed page of each record.
- On page 2 and later, automatically remove a repeated Navy stationery heading from the top of the transcription.
- Treat the letterhead as a block rather than only deleting the words “US NAVY,” so variants such as “U.S. NAVY” and “UNITED STATES NAVY,” plus repeated lines belonging to the same printed heading, are handled together.
- Only remove a leading block that matches the first page’s Navy letterhead. Mentions of the Navy in the body of a letter will remain untouched.
- Preserve all other text, formatting, review status, and the original scans.

## Existing records

- Clean the 21 later-page transcriptions currently identified across 18 records.
- Support both plain-text and formatted transcriptions.
- Rebuild each affected combined record transcription afterward, while retaining the existing safeguard against overwriting a genuinely hand-edited combined transcription.
- Never alter the first page or a reviewed correction beyond removing the confirmed repeated letterhead block.

## Future scans

- Give transcription the page’s true position in the record, including when a single scan or selected scans are transcribed.
- For later pages, instruct the transcription step not to include repeated printed letterhead.
- Apply the same deterministic cleanup before saving, so the result does not depend only on the AI following the instruction.
- Apply this consistently to Transcribe Entire Record, Transcribe Selected, per-page transcription, and envelope scans explicitly added to transcription.

## Verification

- Add tests for plain text, formatted text, Navy wording variants, multi-line repeated headings, page-one preservation, and ordinary in-body Navy references.
- Confirm affected existing pages and their combined transcriptions no longer repeat the heading.
- Verify a newly transcribed later page is cleaned while its first page remains unchanged.

## Technical notes

- Add shared letterhead comparison/removal helpers alongside the existing transcription formatting utilities.
- Extend scan targets with their actual page position and use the first included page as the comparison source.
- Run the existing-data cleanup through authenticated server-side archive logic, then rebuild only affected records.
