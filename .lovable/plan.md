# Francis File Notes Everywhere

## Goal
Make every published Francis File Note and enabled alias visibly highlighted and clickable wherever archive text is read, including the Transcription area. Keep all stored text unchanged.

## Reader-facing coverage
- Use the existing Francis File Note highlight and popover consistently in:
  - the quick transcription panel at the top of an FH record;
  - combined AI and verified transcriptions;
  - individual page transcriptions;
  - search-result excerpts and quotation context;
  - FH summaries, notes, historical text, captions, and related-record notes;
  - Digital Source descriptions, transcripts, notes, segments, and public shared-source pages;
  - Ask Francis answers and admin Ask Francis history;
  - archive notes, weekly recaps, and On This Date narratives;
  - public/shared FH record text.
- Preserve existing record links, search-term highlighting, markdown emphasis, and read-only layouts while adding Francis File Note recognition around them.
- Continue matching whole terms only, using published notes and aliases whose auto-link setting is enabled.

## Editing experience
- Keep all current text fields editable and unchanged.
- Add a compact “Published Notes preview” below relevant multi-line editing fields when their text contains a published Francis File Note term.
- The preview will render the same highlighted, clickable text readers see, without writing links or markup into the saved text.
- Avoid showing empty previews when no published term matches.

## Shared implementation
- Extend the shared Francis File Note text renderer so it can coexist with search highlighting and report whether a block contains recognized terms.
- Reuse that renderer rather than duplicating matching logic on each page.
- Ensure loading the published alias list does not shift or break text, and invalidate/refetch it after note publication or alias changes so newly published notes appear promptly.

## Verification
- Verify a known published term such as “YMS” in FH0051 across the Catalog transcription, Transcription tab, editable preview, search result, and any applicable shared view.
- Check desktop and mobile presentation, popover opening/closing, keyboard focus, and that editable text remains plain text.
- Run the focused type checks and confirm the preview reports a healthy build.
