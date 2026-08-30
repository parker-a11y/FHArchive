/** Shared text-match helpers used by search results and transcription panels. */

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countMatches(text: string | null | undefined, term: string | undefined): number {
  if (!text || !term) return 0;
  const m = text.match(new RegExp(escapeRegExp(term), "gi"));
  return m?.length ?? 0;
}

/** Render text with every case-insensitive occurrence of `term` highlighted. */
export function HighlightedText({ text, term }: { text: string; term?: string }) {
  if (!term) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(term)})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 text-foreground">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export type Snippet = {
  /** Where the match came from, e.g. "Verified transcription" or "Page 3". */
  label: string;
  /** Short excerpt around the match. */
  text: string;
  /** Larger excerpt for the "show full context" toggle. */
  full: string;
};

function excerpt(text: string, index: number, before: number, after: number): string {
  const start = Math.max(0, index - before);
  const end = Math.min(text.length, index + after);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

/** Build up to `max` snippets around occurrences of `term` in one field. */
export function buildSnippets(
  label: string,
  raw: string | null | undefined,
  term: string,
  max = 3,
): Snippet[] {
  if (!raw || !term) return [];
  const text = raw.replace(/\s+/g, " ").trim();
  const hay = text.toLowerCase();
  const needle = term.toLowerCase();
  const out: Snippet[] = [];
  let i = hay.indexOf(needle);
  while (i >= 0 && out.length < max) {
    out.push({
      label,
      text: excerpt(text, i, 60, needle.length + 110),
      full: excerpt(text, i, 400, needle.length + 600),
    });
    i = hay.indexOf(needle, i + needle.length);
  }
  return out;
}
