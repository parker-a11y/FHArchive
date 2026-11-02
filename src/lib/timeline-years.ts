import type { Letter } from "@/lib/queries";

export const UNDATED_YEAR = "Undated";

/**
 * Year buckets for the timeline, in the order the timeline shows them:
 * ascending calendar years first, undated records last. Every year that has at
 * least one record gets a bucket, so a quick pick never points at an empty jump.
 */
export function timelineYears(letters: Letter[]): { year: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const l of letters) {
    const year = l.normalized_date?.slice(0, 4) || UNDATED_YEAR;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  const dated = [...counts.entries()]
    .filter(([year]) => year !== UNDATED_YEAR)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([year, count]) => ({ year, count }));
  const undated = counts.get(UNDATED_YEAR);
  return undated ? [...dated, { year: UNDATED_YEAR, count: undated }] : dated;
}
