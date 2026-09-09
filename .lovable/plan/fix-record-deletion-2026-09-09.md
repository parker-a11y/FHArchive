# Fix record deletion

## Goal
Make the existing **Delete record** action reliably remove a record and its attached scans without manual database cleanup.

## Changes
- Move record deletion into an authenticated administrator-only server action.
- Verify administrator access on the server before deleting anything.
- Remove scan files through storage first, then delete the record and all linked database rows through existing cascade rules.
- Roll back the FH sequence only when deleting the latest issued number, preserving the existing number-reuse behavior.
- Return clear errors if file cleanup or record deletion fails instead of silently continuing.
- Update the existing confirmation dialog to call the secure deletion action; no visible workflow changes.

## Verification
- Confirm an administrator can delete a record with scans and linked data.
- Confirm the record and its stored scan files are gone.
- Confirm deletion remains unavailable to non-administrators.
- Check type safety and the live preview build.
