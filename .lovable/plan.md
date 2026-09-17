# Create Blog Post

A third button in the Recaps section — next to "Generate Weekly Recap" and "Generate Custom Recap" — for writing a blog post from an outline you paste in, backed by real records and real quotes from the archive.

## How it works for you

1. On the Recaps page, press **CREATE BLOG POST**.
2. A window opens with:
   - **Your outline** — a large box where you paste the outline, draft, or notes. This is the spine of the post and is followed as written.
   - **Records to include** — type FH/DS numbers (for example `FH0042, FH0087, DS-0011`). These are always pulled in and used.
   - **Also search the archive for supporting material** (on by default) — finds further letters, photographs, sources and accepted quotations that fit your outline, and offers them as supplementary evidence.
   - **Length** — brief / standard / deep.
   - **Audience & tone** and **extra instructions** — optional.
3. The post is written, then opens in the existing recap page, where you can edit it, add photos, publish it, make it visible to guests, or email it — exactly like a custom recap.

## Rules the writing follows

- Your outline's structure, order and points are preserved; the archive supplies evidence, it does not rewrite your argument.
- Every archival statement carries its record number; quotes appear as blockquotes attributed to the record they came from.
- Records you named are used; anything the archive can't support is flagged rather than invented.
- Cited records get their public links listed at the end, so readers can open the originals.

## Technical notes

- New server function `generateBlogPost` in `src/lib/recaps.functions.ts` (auth + archive-access check, same as the custom recap), calling `runBlogPost` in `src/lib/recaps/weekly.server.ts`.
- Material gathering differs from the recaps: instead of a date window, it is
  1. explicit refs — direct `letters` / `digital_sources` lookups by `archive_id` / `ds_id`;
  2. outline-driven retrieval — reuse the existing `match_research_chunks` vector search plus keyword hits over `research_index`, capped by the chosen length tier;
  3. accepted `ai_suggestions` quotations for those records, and a JPEG derivative for the featured image.
- Stored in `weekly_recaps` with `kind: 'blog'`, a `blog-YYYY-MM-DD-xxxxxx` slug, `range_label` set to the post title's scope, `status: 'draft'`, `public_visible: false`. No schema change needed — `kind` and `slug` already exist.
- Citation validation matches the custom recap: `related_ids` filtered to the archive ids actually supplied to the model.
- UI: new `src/components/recaps/BlogPostDialog.tsx`; the Recaps list shows a "Blog post" badge for `kind === 'blog'`; the recap detail page needs no change beyond accepting the new kind.
- Generation restricted to admins and archivists, matching the other two buttons.
