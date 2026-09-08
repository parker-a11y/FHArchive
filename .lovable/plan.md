# Ask Francis: archive first, history welcome

Today Ask Francis is told to answer using *only* the archive. That keeps it honest but
makes it useless for questions like "how opulent was the Hollywood Hotel?" — where the
letters give a glimpse and outside history gives the rest.

## What changes for you

- Every answer still starts from the archive and still cites FH record numbers for
  anything the archive shows. That does not loosen.
- When a question reaches beyond the letters, Francis may add outside historical
  background — woven into the same answer, with each outside statement plainly marked
  as general history rather than archive evidence, and carrying a real source link.
- Still forbidden, and stated even more firmly than today: inventing quotations,
  inventing FH numbers, people, ships, dates, or stitching a narrative to cover a gap.
  If neither the archive nor a source supports something, Francis says so.
- Sources appear beneath the answer alongside the record citations, so you can tell at a
  glance which claims rest on the family papers and which rest on outside history.

## Where the outside facts come from

Francis reaches for the web only when the question actually calls for it (a place, a
ship, a unit, an event, a period detail) — ordinary archive questions cost nothing extra
and stay as fast as they are now. When it does search, it uses real results and cites
their links; it is instructed never to present unsourced background as if it were
researched.

## Technical notes

- `src/lib/research/agent.server.ts`: rewrite `SYSTEM` to a two-tier evidence policy
  (archive evidence = FH citations; outside history = labelled inline + URL source), and
  keep every anti-fabrication rule intact.
- Add a `needsExternalContext` step: a cheap classification pass on the question (same
  gateway model, JSON out) decides whether outside history is warranted and produces
  1–2 search queries. Archive-only questions skip the search entirely.
- Web search runs server-side through the Perplexity connector (`sonar`, `PERPLEXITY_API_KEY`
  from `process.env`, called inside the handler). If the connector is not linked, the
  step is skipped and Francis answers archive-only, noting that outside context was not
  available — never substituting unsourced recall. I will surface the connect card so
  the connector can be linked in this same turn.
- Extend `ResearchAnswer` with `sources: { title, url, note }[]`; the model may only cite
  URLs actually returned by the search pass, filtered the same way `citations` are
  filtered against retrieved records today.
- `ask_francis_queries` gains a `sources` jsonb column so admin history shows what was
  used; migration includes GRANTs consistent with the existing table.
- UI: `src/routes/_authenticated/ask.tsx` and the admin history page render a "Sources"
  block under the existing citations; share/email output includes it.
