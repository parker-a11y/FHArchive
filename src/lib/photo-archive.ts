/** Pure helpers for the PH photo catalog (no database access). */

/** PH00001 … PH99999, then PH100000 and up — never truncated. */
export function formatPhId(seq: number): string {
  return "PH" + String(seq).padStart(5, "0");
}

/** Case- and spacing-insensitive key, matching the database's name_key. */
export function categoryKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Tidy a box code: "photo 3" / "photo-3" → "PHOTO-003". Other codes are upper-cased and trimmed. */
export function normalizeBoxCode(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ").toUpperCase();
  const m = /^PHOTO[\s-]*(\d+)$/.exec(t);
  if (m) return "PHOTO-" + m[1].padStart(3, "0");
  return t;
}

/** Suggest the next PHOTO-### code after the existing ones. */
export function nextBoxCode(codes: string[]): string {
  let max = 0;
  for (const c of codes) {
    const m = /^PHOTO-(\d+)$/.exec(c);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return "PHOTO-" + String(max + 1).padStart(3, "0");
}

/**
 * Click selection for a list. Shift selects the continuous range from the last
 * clicked row (adding to the selection); otherwise the row toggles.
 */
export function applySelectionClick(
  ids: readonly string[],
  selected: ReadonlySet<string>,
  anchor: string | null,
  clicked: string,
  shift: boolean,
): Set<string> {
  const next = new Set(selected);
  if (shift && anchor && ids.includes(anchor)) {
    const a = ids.indexOf(anchor);
    const b = ids.indexOf(clicked);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    for (let i = lo; i <= hi; i++) next.add(ids[i]);
    return next;
  }
  if (next.has(clicked)) next.delete(clicked);
  else next.add(clicked);
  return next;
}

/**
 * Read a sortable year span from a human date ("Circa 1937", "1940s",
 * "1935–1940", "September 25, 1944"). Returns null when no year is clear —
 * the written text is always kept as typed.
 */
export function parsePhotoYears(text: string | null | undefined): { start: number; end: number } | null {
  if (!text) return null;
  const t = text.trim();
  const decade = /\b(1[6-9]\d0|20\d0)'?s\b/i.exec(t);
  if (decade) {
    const s = Number(decade[1]);
    return { start: s, end: s + 9 };
  }
  const years = [...t.matchAll(/\b(1[6-9]\d\d|20\d\d)\b/g)].map((m) => Number(m[1]));
  if (!years.length) return null;
  return { start: Math.min(...years), end: Math.max(...years) };
}

/** Category filter: any (default) or all of the chosen categories. */
export function matchesCategories(photoCats: readonly string[], chosen: readonly string[], mode: "any" | "all"): boolean {
  if (!chosen.length) return true;
  return mode === "all" ? chosen.every((c) => photoCats.includes(c)) : chosen.some((c) => photoCats.includes(c));
}

/** Suggest the next SLEEVE-### code after the existing ones. */
export function nextSleeveCode(codes: string[]): string {
  let max = 0;
  for (const c of codes) {
    const m = /^SLEEVE-(\d+)$/.exec(c);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return "SLEEVE-" + String(max + 1).padStart(3, "0");
}

/** "SLEEVE 001 — Nov 6, 2026" (plus the optional name). */
export function sleeveLabel(s: { code: string; name: string | null; created_at: string }): string {
  const date = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return [s.code.replace("-", " "), date, s.name].filter(Boolean).join(" — ");
}
