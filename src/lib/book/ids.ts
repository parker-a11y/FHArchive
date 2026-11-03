/** Parses "FH0012, FH40-FH55, 77" into archive ids. */
export function parseArchiveIds(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const tok = raw.trim().toUpperCase();
    if (!tok) continue;
    const range = tok.match(/^(?:FH)?(\d+)[-–](?:FH)?(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let k = lo; k <= Math.min(hi, lo + 500); k++) out.push(`FH${String(k).padStart(4, "0")}`);
      continue;
    }
    const one = tok.match(/^(?:FH)?(\d+)$/);
    if (one) out.push(`FH${String(Number(one[1])).padStart(4, "0")}`);
  }
  return [...new Set(out)];
}
