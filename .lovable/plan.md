# Fix: Human Verify All discards unsaved corrections

## The problem

On a record's Transcription tab, each page's corrections box holds your edits in local
state until you click **Save Corrections**. But **Human Verify All** verifies every page
using the text stored in the database (`bestText`: verified text, else AI text) — it never
sees your unsaved edits.

So if you correct a page and click Human Verify All without saving first:

- The page is marked **human verified** with the **old AI text**.
- Your corrections are not in the verified text and not in the combined record
  transcription.
- The confirm dialog says "using their current text", which wrongly implies your edits
  are included.

## The fix

Make Verify All aware of pending edits in `src/components/letter/TranscriptionPanel.tsx`:

1. **Track each page's current editor text at the panel level.** Each page card reports
   its in-box text and dirty state up to the panel (a small registry keyed by page id),
   instead of the text living only inside the card.
2. **Verify All saves your edits first.** For each unverified page, if its box has
   unsaved changes, verify using the edited text (same as Save Corrections + verify);
   otherwise verify with the existing stored text as today.
3. **Honest confirm dialog.** When pending edits exist, the dialog says so, e.g.
   "This will save your unsaved corrections on 2 page(s) and mark all pages human
   verified." When there are none, the wording stays as-is.
4. **Disable Verify All while a page save is in flight** (already handled via
   `verifyAllBusy`), and after completion the boxes refresh from the saved data so the
   editor and database match.

Envelope pages stay excluded from the combined roll-up exactly as now; no change to
Save Corrections, Transcribe buttons, or guest/read-only behavior.

## Technical notes

- Only `src/components/letter/TranscriptionPanel.tsx` changes: add a
  `Map<pageId, { text, dirty }>` registry populated by each page card via an
  `onTextChange` callback; `verifyAll()` reads `text` from the registry when `dirty`,
  else falls back to `bestText(t)`.
- No database or server-function changes; `saveCorrections(id, text, true)` already
  handles save-and-verify.
- Verify: edit a page without saving, click Human Verify All, confirm the page is
  verified with your corrected text and the combined record transcription includes it.
