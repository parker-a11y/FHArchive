# Book Builder — Phase 3

Phase 1 (letters, Envelope First layout, PDF export) and Phase 2 (custom pages, visual editor) stay as they are. Existing books open and export exactly as today until a Phase 3 option is switched on.

## What you'll get

1. **Chapters**
   - "Add chapter" puts a chapter opening in the sequence (title, optional subtitle and epigraph), always starting on a right-hand page.
   - Letters and custom pages under it belong to that chapter; chapter titles appear in the running heads.

2. **Table of contents**
   - Optional, generated automatically from chapters (and optionally each letter's FH number and date).
   - Page numbers come from the same layout used by the preview and PDF, so they always match.

3. **Front matter and cover**
   - Title page, copyright/colophon page (factual: archive name, compiler, date made), optional dedication.
   - Cover designer: front cover, spine, back cover from a template, with title, subtitle, author line and a photo from the archive or an upload. Spine width is worked out from the page count and paper.
   - The cover exports as its own PDF, separate from the interior.

4. **Themes**
   - Three to four looks per book (e.g. Classic Literary, Wartime Ledger, Quiet Modern): type sizes, margins, ornaments, heading styles, ink tones. All use the embedded book fonts; the archive text never changes.

5. **Facing-page transcription (optional layout)**
   - Scan on the left page, its transcription on the right, page by page, as a per-book alternative to Envelope First.

6. **Print-company profiles**
   - Blurb, Lulu and BookBaby profiles for common trim sizes (starting with 8.5x11 and 6x9): trim, bleed, safe margins, gutter growth with page count, minimum page counts and page-count multiples.
   - "Generic home/office print" stays available.

7. **Preflight check before export**
   - Lists problems and warnings: low-resolution images, content outside the safe area, missing bleed on full-bleed photos, page count not allowed by the printer, missing fonts, changed archive records not refreshed.
   - The book is only called "print-ready" for a chosen printer profile when preflight passes. Otherwise the export is labeled a proof.

## Safeguards
- The book still only points to archive records; nothing in letters, scans or transcriptions is changed or copied.
- Export manifests also record the theme, printer profile and preflight result.

## Testing
- Unit tests: TOC page numbers match the real page plan, chapters open on right-hand pages, spine width math, printer page-count rules, preflight catching each problem type.
- A real test book with 2 chapters, TOC, front matter, a cover, and a Lulu 8.5x11 profile: check the interior and cover PDFs (sizes, bleed, page numbers, fonts) and compare them with the preview.

## Technical details
- `book_items.item_type` gains `chapter`; chapter data goes in `page_doc`. `book_projects.settings` gains `theme`, `layout` (`envelopeFirst` | `facing`), `printerProfile`, `frontMatter`, `toc`. A new `book_covers` row per book holds the cover design (editor RLS + grants).
- Themes and printer profiles live in `src/lib/book/themes.ts` and `src/lib/book/printers.ts`, and `layout.ts` reads them (still one layout engine). TOC uses two passes: plan the pages, then fill in the numbers. The TOC length is fixed after the first pass so page numbers can't shift.
- Cover rendering reuses the custom-page box model and PDF writer at full-spread size. A second export writes it as a separate file.
- Preflight runs in `src/lib/book/preflight.ts`, used by both the editor panel and the export worker.

## Build order
Chapters + TOC + front matter, then themes, then printer profiles + preflight, then cover, then facing-page layout. I'll test after each step and report when all are done.
