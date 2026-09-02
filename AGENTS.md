
## Storage buckets

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
