Remove the "private, unlisted links" footer sentence from archive emails.

## What to change
- `src/lib/email-templates/archive-record.tsx` — delete the sentence "Links open private, unlisted archive pages and can be revoked at any time." from the footer block, keeping the sender-name line intact.
- `src/routes/api/send-sample-email.ts` — remove the same sentence from the sample message string so test emails match the new footer.

## Verification
- Search the repo for the phrase to confirm no other occurrences remain.
- Run typecheck and build to ensure no JSX/text formatting issues.
