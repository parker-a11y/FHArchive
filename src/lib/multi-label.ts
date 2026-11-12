export const MULTI_LABEL_MAX = 30;

/**
 * Records for a multi-record label: the current record plus the records
 * immediately before it (descending FH order), stopping at the first record
 * whose label was already printed. Never goes further back than that.
 */
export function unprintedRun<T extends { id: string; fh_seq: number }>(
  descending: T[],
  printed: Set<string>,
  max = MULTI_LABEL_MAX,
): T[] {
  const out: T[] = [];
  for (const r of descending) {
    if (printed.has(r.id)) break;
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}
