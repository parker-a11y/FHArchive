export type PersonMatch = { id: string; name: string; matched_on: string; score: number };
export type PersonResolution =
  | { kind: "exact"; person: { id: string; name: string } }
  | { kind: "ambiguous"; candidates: PersonMatch[] }
  | { kind: "new" };

export function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export const ASK_THRESHOLD = 0.42;

export function resolvePersonMatches(name: string, matches: PersonMatch[]): PersonResolution {
  const target = normalizeName(name);
  const exact = matches.filter((m) => target && normalizeName(m.matched_on) === target);
  if (exact.length === 1) {
    const person = exact[0];
    return { kind: "exact", person: { id: person.id, name: person.name } };
  }
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact };
  const close = matches.filter((m) => m.score >= ASK_THRESHOLD);
  return close.length ? { kind: "ambiguous", candidates: close } : { kind: "new" };
}