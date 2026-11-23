
## Storage buckets

- Letter reading context is a read-only collapsible panel backed by existing people/place links; use local React state with an accessible Button/hidden region instead of loading another collapsible primitive, and paginate narrow membership reads with deduplicated record IDs so context stays permission-scoped and evidence-based.

- Minor-edit AI confirmation retains previously reviewed suggestions and updates the current transcription fingerprint through an editor-authorized server function; it never approves first-time suggestions or changes archival text.

- Delivered archive emails retain a minimal structured record/options snapshot in send_payload; prior-send reads paginate all history and never infer record membership from free text.
- Email recovery keys isolate saved draft IDs, explicit entry-point/resend scopes, and otherwise record/context identity; never reuse the legacy global note slot across composers.

- Current physical storage summaries group paginated, narrow `letters` reads by trimmed `storage_location`, independently of provenance containers; this keeps box contents complete and preserves existing record permissions.

- Standalone email uploads use the private `ds-files` sender/email-attachments namespace; drafts and queued payloads retain file metadata, sent emails retain attachment rows, and delivery/shared rendering signs download links without requiring an FH record.

- Combined transcription page boundaries use the shared transcription-format helper; join only continuing prose and preserve page-level source text and structural breaks.
- Shared rich-text editors must shrink to their container and wrap long image tokens and URLs with overflow-wrap: anywhere; embedded images must not widen email or blog editing dialogs.
- Shared photo frames use phrasing-compatible elements with a figure role; image tokens can appear within rich-text paragraphs without invalid HTML nesting.

- The shared image picker stops click propagation at its dialog boundary and opens its own file input by ref; portaled clicks must not reach email-row handlers that cancel native file selection.

- Daily backup callbacks use the managed HTTP scheduler and generated cron authenticator, never a copied credential in job_config; this keeps credential rotation platform-owned.
- Backup storage enumeration retries bounded transient connection failures and paginates its mirror index; this prevents large archives from failing or re-uploading indexed files.
- Backup file mirroring gets its to-do list from one `backup_pending_objects` database query (never a folder-by-folder storage walk, which exhausted connections), copies each file to Drive in fixed-size ranged/resumable chunks, and runs within a bounded per-run window; this keeps memory flat and runs finite.

- Email calendar month navigation accepts archive-email drags with a delayed hover, and adjacent-month days remain drop targets; cross-month moves reuse the existing rescheduling checks.

- Scan gallery reordering resolves an explicit before/after insertion boundary through `scan-order`; the marker and saved order use the same helper to prevent directional off-by-one drops.

Files live in Supabase Storage, not in the database:

- `scans` — archival masters (TIFF/JPEG/PDF) and their generated JPEG/thumbnail
  derivatives for FH records. Private.
- `ds-files` — Digital Source attachments. Private.
- `container-photos` — source container/box photos. Private.
- `research-snapshots` — generated research/AI export bundles. Private.

All buckets are private; the app reads them through signed URLs. Buckets are
created and configured outside of migrations (storage tooling, not SQL) — do not
add `INSERT`/`UPDATE` on `storage.buckets` to a migration. RLS policies on
`storage.objects` do belong in migrations.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Gallery photos live in `photos` (not FH records); converted FH photograph records keep their row with record_type `moved_to_gallery`, which `search_letters` excludes, so FH numbers, history and old links survive.
- Photo gallery ordering uses the scan before/after insertion helper and an atomic, RLS-scoped reorder operation; filtered moves retain hidden photos and file uploads remain separate from internal drags.

## Book Builder
- Book projects (`book_projects`, `book_items`, `book_exports`) only reference archive records and never write to letters, scans or transcriptions; this keeps the archive the single source of truth.
- Custom pages are `book_items` of type `page` whose `page_doc` holds boxes in points; archive/gallery images are referenced by ID and uploads live in the private `book-images` bucket, so the layout engine renders them like letters and nothing in the archive is copied or cropped.
- Layouts are selected per book in `settings` and implemented as branches of the one layout engine; add future layouts there rather than in the preview or PDF writer.
- Themes (`src/lib/book/themes.ts`) and printer profiles (`src/lib/book/printers.ts`) are data read by the layout engine; chapters are `book_items` of type `chapter`, the contents pages are reserved from the entry list and filled after layout, and covers (`book_covers`) export as a separate `kind = 'cover'` job. This keeps preview, PDF and page numbers on one code path.
- Preflight (`src/lib/book/preflight.ts`) is shared by the editor and export worker; only a real printer profile with no preflight errors sets `print_ready`, so a proof is never mislabelled.
- One layout engine (`src/lib/book/layout.ts`) produces the page plan for both the preview and the PDF, measured with the same embedded EB Garamond files; this keeps on-screen page numbers identical to the export.
- PDFs are written incrementally in stored parts (structure/fonts, image batches, xref) by a leased background runner driven by an every-minute schedule, then streamed as one file through a signed download route; this keeps memory per request bounded for large books.
- Full-resolution print copies are new `file_derivatives` rows of kind `print`, made in the browser from the untouched TIFF masters and oriented to match the viewing copy; the server cannot decode large TIFFs.
- Each book item stores the source fingerprint it was added or refreshed at; exports are blocked while any record changed, and each export keeps a manifest of fingerprints, image derivatives and transcription hashes for auditing.

- The Writing Assistant (`/writer`) saves its conversations and standing instructions in the database, reads FH records without changing them, and hands drafts to the existing email/blog composer. This keeps history in the archive and avoids a second send path.
- Writing Assistant reads recent sent/scheduled emails and recap/blog posts (read-only) as continuity context, never as archival evidence; this keeps voice and threads consistent without new quote sources.
- The Writing Assistant's per-session record cap lives in one shared module (`src/lib/writer-limits.ts`) used by the server, the assistant page, and the All Records handoff button, and the UI always names which records are attached and which were left out; this prevents a selection from being silently truncated before the AI reads it.
- Standalone photographs carry permanent PH numbers (`photos.ph_seq`/`ph_id`) assigned by a database trigger once an admin approves the one-time backfill; categories (many-to-many), upload batches and PHOTO-### boxes are separate tables so categorizing, boxing or editing never changes a PH number or duplicates files.
- Photo connections live in `photo_links` (photo → letter/photo/person by ID, with documented/recollection/tentative certainty); they reference records only, so no image files are duplicated and photo-to-photo links read both ways.
- Photo sleeves (`photo_sleeves`, SLEEVE-###) sit between photos and PHOTO boxes; database triggers keep a sleeved photo's `box_id` equal to its sleeve's box, so every existing box view stays correct and moving a sleeve moves its photos.
- Photo rotation writes new viewing/thumbnail derivatives and updates both references only after upload; masters and old paths stay untouched.
