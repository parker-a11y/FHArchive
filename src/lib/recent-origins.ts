import { supabase } from "@/integrations/supabase/client";

/**
 * Mailing origins the archivist has actually been using lately, newest first.
 * Quick picks under the Mailing origin field follow the archive instead of a
 * fixed pair of places, so the places that keep recurring stay one click away.
 */
export type OriginUsage = {
  origin: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A record counts as "used" on the later of its creation and its last edit, so
 * correcting an old letter's origin brings that place back to the top of the
 * list. Repeats of one place collapse to a single pick; blanks are ignored.
 */
export function pickRecentOrigins(rows: OriginUsage[], limit = 2): string[] {
  const lastUsed = new Map<string, number>();
  for (const row of rows) {
    const value = (row.origin ?? "").trim();
    if (!value) continue;
    const touched = Math.max(Date.parse(row.created_at) || 0, Date.parse(row.updated_at) || 0);
    if (!lastUsed.has(value) || touched > (lastUsed.get(value) ?? 0)) {
      lastUsed.set(value, touched);
    }
  }
  return [...lastUsed.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, limit))
    .map(([value]) => value);
}

/** Origins of the most recently catalogued and edited records. */
export async function fetchRecentOrigins(limit = 2): Promise<string[]> {
  const { data, error } = await supabase
    .from("letters")
    .select("origin,created_at,updated_at")
    .not("origin", "is", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return pickRecentOrigins((data ?? []) as OriginUsage[], limit);
}
