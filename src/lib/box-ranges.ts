/** Helpers for selecting record ranges and describing box contents on labels. */

/** Pulls the numeric part out of "FH0050", "fh 50", or "50". */
export function parseRecordNumber(input: string): number | null {
  const m = input.trim().match(/(\d+)\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Condenses [1,2,3,5,8,9] into "FH0001–FH0003, FH0005, FH0008–FH0009". */
export function condenseRanges(ids: string[]): string {
  const rows = ids
    .map((id) => ({ id, n: parseRecordNumber(id) }))
    .filter((r): r is { id: string; n: number } => r.n !== null)
    .sort((a, b) => a.n - b.n);
  if (!rows.length) return "";

  const parts: string[] = [];
  let start = rows[0];
  let prev = rows[0];
  for (const row of rows.slice(1)) {
    if (row.n === prev.n + 1) {
      prev = row;
      continue;
    }
    parts.push(start.n === prev.n ? start.id : `${start.id}–${prev.id}`);
    start = row;
    prev = row;
  }
  parts.push(start.n === prev.n ? start.id : `${start.id}–${prev.id}`);
  return parts.join(", ");
}
