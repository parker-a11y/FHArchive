/**
 * Taxonomy hygiene helpers.
 *
 * Keywords, tones, people and places drift into near-duplicates ("Officer
 * Candidate School" / "officer candidate  school") unless names are cleaned at
 * the moment of entry. Everything that creates a controlled-vocabulary term
 * should run its value through `normalizeName` first and compare with
 * `sameName` before inserting.
 */

/** Trim, collapse inner whitespace, normalize quotes/dashes. */
export function normalizeName(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Case- and whitespace-insensitive comparison of two vocabulary terms. */
export function sameName(a: string, b: string): boolean {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();
}

/** First existing term matching `value`, if any. */
export function findExisting<T>(
  value: string,
  items: T[],
  nameOf: (item: T) => string,
): T | undefined {
  return items.find((i) => sameName(nameOf(i), value));
}
