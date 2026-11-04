# Book Builder — Phase 2: Custom Pages

Phase 2 adds pages you create yourself (introductions, photo pages, research essays, section dividers) that sit in the same ordered list as the letters. The letters, scans and transcriptions stay untouched. Phase 3 (themes, chapters, table of contents, covers, printer profiles) still waits for your separate OK.

## What you'll be able to do
- **+ Add Page** button in the book's list, and "Insert page here" between any two items. Custom pages drag and reorder exactly like letters.
- **Pick a template** (17), each a starting layout you can change:
  1. Blank page 2. Section divider 3. Full-page text 4. Text with heading 5. Quotation page 6. Single photo, fit 7. Single photo, full-bleed 8. Photo + caption 9. Photo top, text below 10. Text left, photo right 11. Two photos 12. Four-photo grid 13. Photo collage (3) 14. Map / document page 15. Timeline / dates list 16. Dedication / epigraph 17. Research essay (long-form)
- **Visual page editor**: click a page to edit it on a true-to-size page. Add text boxes and image boxes, move and resize them by dragging, snap to margins, centre lines and other boxes, undo/redo (Ctrl/Cmd+Z, Shift+Z), delete, bring forward/back.
- **Text**: heading, body, caption and quotation styles in EB Garamond; bold/italic; left/centre/right.
- **Images**: upload new photos, or pick from the archive (FH record scans, envelopes, Photo Gallery). Each image box can be **Fit** (whole image, never cropped), **Fill** (fills the box, cropped visually only — the original file is never altered) or **Full-bleed** (edge to edge). Low-resolution warnings work the same as for letters.
- **Long-form research flow**: the Research essay template flows text across as many pages as needed with automatic page numbers, like transcriptions do, so you can paste a long piece.
- **Modern vs. historical**: custom-page text is styled visibly differently (sans-serif small caps label "Editor's note" option, different tone) from transcribed letter text, per the archival rule.
- Preview and PDF show custom pages identically, with the same page numbers.

## Safeguards
- Archive images used on custom pages are referenced, not copied or edited; "Fill" cropping is a display setting only.
- Uploaded book images go to their own private storage area, separate from archive scans.
- If an archive image used on a custom page changes, the page is flagged like a changed letter.
- Existing books keep working unchanged.

## Testing
- Add one of each template to a test book with real records, check editor ↔ preview ↔ PDF match, page numbering, snapping/undo, fit/fill/full-bleed in the PDF, and a 6+ page research essay.

## Technical details
- `book_items` gains `item_type` ('record' | 'page') and `page_doc` jsonb (template id, boxes with x/y/w/h in points, text runs, image refs `{source:'archive'|'gallery'|'upload', id, mode}`); `letter_id` becomes nullable with a check constraint. Editor-scoped RLS unchanged.
- New private `book-images` bucket with editor RLS on `storage.objects`; uploads get a viewing copy via the existing derivative helper.
- `layout.ts` gains a `page` branch producing `PlannedPage` kind `custom`; long-form boxes reuse the transcription text flow. `ImageBox` gains `crop`/`bleed`; `pdf-writer.ts` adds clipping paths for Fill and bleed handling.
- Editor: `src/components/book/PageEditor.tsx` with pointer-based drag/resize, snap guides, command-stack undo/redo; templates in `src/lib/book/templates.ts`.
- Unit tests for template generation, fill crop math, snapping and long-form pagination.
