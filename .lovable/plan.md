# Book Builder — Architecture Proposal (awaiting approval)

## What I found in the current archive
- **Records**: FH records live in the existing records table (FH IDs, dates, author/recipient, origin/destination, location line, storage). Book Builder will only *point to* these — no copies.
- **Scans**: each record's files are kept in order (sort order, page label such as letter page vs. envelope, rotation, the "include in transcription" flag). Originals (TIFF/JPEG/PDF) are kept untouched in private storage, with generated viewing JPEGs and thumbnails that record their pixel width and height — so resolution can be checked without opening the files.
- **Envelopes**: already identified by file label (the same logic Envelope Review and the "no envelope" setting use). Book Builder reuses it, so it never guesses or substitutes an envelope.
- **Transcriptions**: stored per scanned page (verified text preferred over AI text), with formatted text and an existing helper that joins pages into one combined transcription. Book Builder reuses that helper, so the text matches what you already see.
- **Search**: the All Records search (date, From/To, location, text) and range/shift-click selection can be reused in the "Add records" picker.
- **Access**: Admin / Archivist / Guest roles. Book Builder will be **Admin and Archivist** (editors) only; guests won't see it.
- **PDF today**: only browser "print to PDF" pages for emails and labels, plus a PDF page reader. No true book PDF engine yet.

## Proposed approach

### Data stored (new and separate, archive never changed)
- **Book projects**: title, subtitle, description, theme, trim size/orientation, margins, print preferences, cover settings (later phases), timestamps.
- **Book items**: the ordered sequence. Each item is either a *record reference* (FH record + per-book options like one or two scans per page) or a *custom page* (Phase 2). One ordered list means letters and custom pages always share one sequence.
- **Book exports**: history of each generated PDF (type, page count, warnings, file, date).
- **Book images** storage area (Phase 2) for uploaded photos, kept apart from archive scans.
- Duplicating a project copies only these book rows, never archive data.

### Book Builder screens
- **Dashboard** (`Book Builder` in sidebar): project cards with page count and last edited, plus New, Rename, Duplicate and Delete.
- **Project editor**:
  - Left: a numbered, drag-sortable list (same drag behaviour as scans and photos) with up/down arrows, remove-from-book, "Sort oldest→newest / newest→oldest" and "Restore saved custom order" (the previous order is kept as a snapshot).
  - Each row shows FH ID, date, from/to, location, thumbnail, scan count, envelope ✓/✗ and transcription ✓/✗, plus warnings.
  - **Add records** panel: paste FH IDs ("FH0012, FH0040–FH0055"), or search/filter with checkboxes and Add selected. Every record page also gets an "Add to book" button.
  - Right: live preview.
- Order saves automatically after each change.

### Layout and pagination (one engine for preview and PDF)
- A single **layout engine** turns the sequence into physical pages: record header, then each letter scan (fit inside margins, centred, never cropped, optional two per page), then envelope front/back if they exist, then the transcription flowing across as many pages as needed. Paragraphs are kept intact where possible, with no overlaps.
- The preview shows these same computed pages, so the on-screen page numbers match the PDF.
- Classic Literary theme: ivory pages, serif type (EB Garamond, embedded), small page numbers, running header with the book title and letter date, and a quiet metadata line. Missing information is left out, never invented.

### PDF generation
- I'll build the PDF on the server with **pdf-lib**, a pure-JavaScript library that can embed fonts and place images at exact sizes. Sizes are in points (8.5 × 11 in = 612 × 792).
- **Image quality**: it uses the original JPEG masters directly. TIFF masters can't be embedded directly, so it uses the largest generated JPEG instead and the warning names that record. If you want true full-resolution TIFF reproduction later, that needs a high-quality JPEG conversion step, which I'll propose in Phase 3.
- **Resolution warnings**: effective DPI = pixel size ÷ printed size, with warnings below 300 DPI and errors below 150. Missing scans, missing transcriptions and records with no envelope are listed too.
- **Large books**: the server has limited memory and time per request. Export therefore runs as a background job in chunks of a few records, assembles the PDF, saves it to private storage and reports progress in the UI. Exports appear in history with a download link.
- The export is built around a "print profile" object (trim, bleed, gutter, colour mode). Phase 1 includes only "Standard 8.5×11 (home/digital)". Blurb, Lulu and BookBaby profiles plug in later. Nothing will be labelled "print-ready" until a provider profile and preflight checks exist.

### Archival safeguards
- Read-only access to records, scans and transcriptions. Nothing is edited, cropped or replaced.
- Transcription text is rendered exactly as stored, including uncertainty markers. Modern commentary (Phase 2) gets a visibly different style.
- If a source record changes after it was added, the project shows "Source updated — refresh" rather than silently overwriting anything.

## Phases
1. **Phase 1 (on approval)**: dashboard, projects, add by ID/search/record page, drag and arrow reordering, sorting, autosave, the letter → envelope → transcription layout, Classic Literary at 8.5×11, preview (single page and spread, zoom), background PDF export with history, missing-file and low-resolution warnings. I'll test it with a 10–15 letter book and check the PDF contents and order.
2. **Phase 2 (after your OK)**: + Add Page, 17 templates, visual editor (text, images, captions, snapping, undo/redo), uploads and archive-image picker, long-form research flow, full-bleed/fit/fill options.
3. **Phase 3 (after your OK)**: themes, chapters, front/back matter, auto table of contents, facing-page transcription, cover designer, Blurb/Lulu/BookBaby profiles from their published specs, spine calculation, preflight, reusable templates.

## Risks to know
- TIFF-only records use the largest generated JPEG until full-resolution conversion is added (Phase 3).
- Very large books (100+ letters, many gigabytes of scans) will take minutes to export. They will run in the background, not instantly.
- Printer specs change over time. In Phase 3 I'll check current provider documents and flag anything I can't confirm.
