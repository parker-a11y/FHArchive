# Create Blog Post

A third button in the Recaps section — next to "Generate Weekly Recap" and "Generate Custom Recap" — for writing a blog post from an outline you paste in, backed by real records and quotes from the archive, plus optional outside historical research.

## How it works for you

1. On the Recaps page, press **CREATE BLOG POST**.
2. A window opens with:
   - **Your outline** — a large box where you paste the outline, draft, or notes. This is the spine of the post and is followed as written.
   - **Records to include** — type FH/DS numbers (for example `FH0042, FH0087, DS-0011`). These are always pulled in and used.
   - **Also search the archive for supporting material** (on by default) — finds further letters, photographs, sources and accepted quotations that fit your outline.
   - **Add outside historical research** (optional, off by default) — looks up background history on the web to fill in context your files don't cover, using the same research service Ask Francis uses. Outside facts are cited with links and kept clearly separate from archive evidence.
   - **Length** — brief / standard / deep.
   - **Audience & tone** and **extra instructions** — optional.
3. The post is written, then opens in the existing recap page, where you can edit it, add photos, publish it, make it visible to guests, or email it — exactly like a custom recap.

## Rules the writing follows

- Your outline's structure, order and points are preserved; the research supplies evidence, it does not rewrite your argument.
- Every archival statement carries its record number; quotes appear as blockquotes attributed to the record they came from.
- Outside historical claims are attributed to their source with a link, never blended in as if they came from the family papers.
- Nothing is invented: if neither the archive nor the research supports a point in your outline, the post says so rather than filling the gap.
- Cited records get their public links listed at the end, along with a short "Further reading" list of outside sources when research was used.

## Technical notes

- New server function `generateBlogPost` in `src/lib/recaps.functions.ts` (auth + archive-access check, same as the custom recap), calling `runBlogPost` in `src/lib/recaps/weekly.server.ts`.
- Material gathering differs from the recaps: instead of a date window, it is
  1. explicit refs — direct `letters` / `digital_sources` lookups by `archive_id` / `ds_id`;
  2. outline-driven retrieval — reuse the existing `match_research_chunks` vector search plus keyword hits over `research_index`, capped by the chosen length tier;
  3. accepted `ai_suggestions` quotations for those records, and a JPEG derivative for the featured image;
  4. optional outside research — reuse the existing Perplexity Agent API path from `src/lib/research/agent.server.ts` (extract/export the `searchOutsideHistory` helper rather than duplicating it), with queries derived from the outline headings. A failed lookup is reported in the post's material notes instead of silently dropping.
- Stored in `weekly_recaps` with `kind: 'blog'`, a `blog-YYYY-MM-DD-xxxxxx` slug, `status: 'draft'`, `public_visible: false`. No schema change needed — `kind` and `slug` already exist; outside sources are appended into `body_md` as a linked list.
- Citation validation matches the custom recap: `related_ids` filtered to the archive ids actually supplied to the model.
- UI: new `src/components/recaps/BlogPostDialog.tsx`; the Recaps list shows a "Blog post" badge for `kind === 'blog'`.
- Generation restricted to admins and archivists, matching the other two buttons.
