# Create a Francis File Note from anywhere

Highlight a word or phrase anywhere in the archive, right-click, and choose
**Create Francis File Note** — without leaving the page you are reading.

## How it works for you

1. Select text (a ship name, an abbreviation, a place) in a transcription, a
   summary, a recap, an On This Date narrative, an Ask Francis answer — anywhere
   in the app.
2. Right-click. A small archive menu appears with:
   - **Create Francis File Note "YMS"**
   - **Open Francis File Note** (only when the selected term already has one)
   - **Search the archive for "YMS"**
   - Your browser's own menu is still available with a second right-click or the
     usual keyboard shortcut.
3. Choosing "Create" opens a compact panel over the page showing the selected
   term, the sentence it came from, and any existing notes that look like the
   same thing (so duplicates get caught before they are made).
4. From that panel you can:
   - **Save as draft** — creates the note and closes, you stay where you were.
   - **Draft with AI and open** — writes the definition, background and archive
     context from the term plus the surrounding sentence, then opens the full
     editor.
   Nothing is ever published automatically; new notes start as drafts.

Only administrators see the menu item, since only administrators can create
notes. Guests and archivists get their normal browser menu, unchanged.

On touch devices there is no right-click, so selecting text shows a small
floating "Francis File Note" button instead.

## Notes

- The selected sentence is carried into the note as context, so the AI draft
  knows how the term was actually used in the letter.
- If the selection already matches a published note, the menu offers to open it
  rather than creating a second one.
- Selections longer than a short phrase are trimmed, and selecting nothing just
  gives you the plain browser menu.

## Technical detail

- New `src/components/ffn/FfnSelectionMenu.tsx`: a single app-level listener for
  `contextmenu` that reads `window.getSelection()`. If there is a non-empty
  selection of reasonable length and the user is an admin, it prevents the
  default menu and renders a small positioned menu (portal + fixed position,
  closes on Escape, outside click, scroll and route change). Otherwise it does
  nothing and the browser menu shows as usual.
- Mobile/touch: a `selectionchange` listener renders a floating action button
  anchored to the selection rect; same handler as the menu item.
- New `src/components/ffn/QuickNoteDialog.tsx`: Dialog with the term, an
  editable display title, the captured sentence, duplicate results from the
  existing `findSimilarNotes`, and the two actions. Uses `createNote` from
  `src/lib/ffn.ts` and the existing `draftFrancisFileNote` server function
  (already admin-gated) for the AI path, then navigates to
  `/admin/notes/$noteId`.
- Mounted once in `src/components/AppShell.tsx` so it is available on every
  signed-in page; also mounted on the public `/notes` pages is not needed.
- Context capture: expand the selection to sentence boundaries from the parent
  element's `textContent`, capped at ~400 characters.
- No database or policy changes — creation already runs through the admin-only
  RLS on `ffn_notes`.
