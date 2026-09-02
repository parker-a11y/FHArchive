# Fix frozen “Confirm new person record” dialog

## Goal
Make new-person confirmation reliably actionable instead of opening in a permanent “Creating…” state.

## Implementation
- Split the shared loading state in `MatchPersonDialog` into separate states for matching an existing person and creating a new person.
- When “Create a new person” is chosen from fuzzy-match results, close the match dialog and open the confirmation dialog without carrying over the match dialog’s busy state.
- Keep each dialog’s Cancel/Close behavior disabled only while its own database action is actively running.
- Preserve the existing promise-based result flow so callers continue receiving the created or matched person without workflow changes.

## Verification
- Reproduce the fuzzy-match path: enter a similar short name, choose “Create a new person,” and confirm the second dialog opens with active Cancel and Create buttons.
- Create the person and verify the dialog closes, the caller resumes, and the new person appears once.
- Test canceling both dialogs and confirm no stuck loading state remains on the next attempt.
