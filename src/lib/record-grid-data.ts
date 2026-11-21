import { supabase } from "@/integrations/supabase/client";
type KeywordRow = { letter_id: string; keywords: { name: string } | null };

function groupKeywords(tags: KeywordRow[]) {
  const m: Record<string, string[]> = {};
  for (const t of tags) {
    if (!t.keywords) continue;
    (m[t.letter_id] ??= []).push(t.keywords.name);
  }
  return m;
}

/** Keyword names for a set of letter ids, fetched in PostgREST-safe chunks. */
export async function fetchKeywordsForLetters(ids: string[]): Promise<Record<string, string[]>> {
  const all: KeywordRow[] = [];
  const PAGE = 1000;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("letter_keywords")
        .select("letter_id, keywords(name)")
        .in("letter_id", chunk)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as KeywordRow[];
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  return groupKeywords(all);
}

/** Pending / total AI suggestion counts for the records on the current page. */
export async function fetchAiStateForLetters(
  ids: string[],
): Promise<Record<string, { total: number; pending: number }>> {
  const out: Record<string, { total: number; pending: number }> = {};
  const PAGE = 1000;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("letter_id, status")
        .in("letter_id", chunk)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as { letter_id: string; status: string }[];
      for (const r of rows) {
        const s = (out[r.letter_id] ??= { total: 0, pending: 0 });
        s.total += 1;
        if (r.status === "pending") s.pending += 1;
      }
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

