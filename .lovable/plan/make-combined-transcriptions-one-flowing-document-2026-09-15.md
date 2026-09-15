# Make combined transcriptions one flowing document

Remove system-added page headings such as **“— Page 2 (Page 2 Front) —”** from combined record transcriptions everywhere, while leaving the separate page-by-page review panes unchanged.

## What will change

- Combined AI and verified transcriptions will be assembled from the page text without inserting page-number or scan-label headings.
- The record page, Catalog transcription, guest view, public record links, email previews, sent-email links, newly sent archive emails, and other views that use the combined transcription will show the same clean, flowing text.
- Genuine paragraph breaks, salutations, closings, signatures, and wording within each page will remain intact. Only the artificial boundaries inserted between scanned pages will be removed.
- Existing combined transcriptions will be cleaned so this applies to records already in the archive, not only newly transcribed records.
- Separate scan transcription panes will continue to identify each page because those are page-specific review tools.

## Safeguards

- Add one shared cleanup rule for legacy page-marker formats rather than duplicating replacement logic across screens and email templates.
- Update the roll-up comparison so removing old markers does not falsely label an automatically assembled transcription as a hand edit.
- Keep genuinely hand-edited combined transcriptions protected; clean their display/output without replacing their wording.
- Already-delivered emails cannot be altered in recipients’ mailboxes. New sends, previews, and archive-hosted sent-email links will use the clean transcription.

## Technical details

- Add a pure combined-transcription formatter that removes only system-generated page headings and joins the resulting page boundary without adding a visible page break.
- Change both combined-transcription creation paths in `transcription.server.ts` and `transcription.functions.ts` to produce marker-free text.
- Apply the same formatter at shared output boundaries (`archive-email.server.ts`, record shares, and combined on-screen views) so legacy or manually preserved database content cannot leak page headings.
- Backfill `letters.transcription_raw_ai`, `letters.transcription_verified`, and `letters.transcription_rollup_text` for existing system-generated markers, preserving all other text and statuses.
- Add focused regression coverage for labeled pages, unlabeled pages, genuine paragraph breaks, and text that contains an ordinary human-written reference to a page.
