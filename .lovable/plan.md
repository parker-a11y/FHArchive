# Tighten archive email footer wording

Update the footer in `src/lib/email-templates/archive-record.tsx` so it no longer repeats "Harrington Family Archive" when the sender name is already the archive name, and so it clearly describes the links as private, unlisted, and revocable.

## Changes

**File: `src/lib/email-templates/archive-record.tsx`**

- Replace the current footer sentence construction with conditional wording:
  - If `senderName` is provided and is not "Harrington Family Archive", render: "Sent by {senderName} from the Harrington Family Archive."
  - Otherwise, render: "Sent by the Harrington Family Archive."
- Append a consistent second sentence: "Links open private, unlisted archive pages and can be revoked at any time."

No other templates, server functions, or routes change.