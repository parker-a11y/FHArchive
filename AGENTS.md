
## Storage buckets

- Combined transcription page boundaries use the shared transcription-format helper; join only continuing prose and preserve page-level source text and structural breaks.
- Shared rich-text editors must shrink to their container and wrap long image tokens and URLs with overflow-wrap: anywhere; embedded images must not widen email or blog editing dialogs.

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
