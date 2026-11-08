import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * AI-analysis review state per record — the purple/green half of the
 * traffic-light health dots (see record-health). One shared query key, so every
 * screen that shows dots (timeline list, this-week and this-month calendars)
 * pays for a single read. Counts are read as aggregates, which keeps the whole
 * archive at a few hundred rows instead of every suggestion row.
 */
export const AI_STATE_QUERY_KEY = ["letters-ai-state"] as const;

export type AiStateByLetter = Record<string, { total: number; pending: number }>;

async function fetchAiStateByLetter(): Promise<AiStateByLetter> {
  const out: AiStateByLetter = {};
  const [totals, pending] = await Promise.all([
    supabase.from("letters").select("id, ai_suggestions(count)"),
    supabase
      .from("ai_suggestions")
      .select("letter_id")
      .eq("status", "pending"),
  ]);
  if (totals.error) throw totals.error;
  if (pending.error) throw pending.error;
  for (const r of (totals.data ?? []) as {
    id: string;
    ai_suggestions: { count: number | string }[];
  }[]) {
    out[r.id] = { total: Number(r.ai_suggestions?.[0]?.count ?? 0), pending: 0 };
  }
  for (const r of (pending.data ?? []) as { letter_id: string }[]) {
    const s = (out[r.letter_id] ??= { total: 0, pending: 0 });
    s.pending += 1;
  }
  return out;
}

export function useAiStateByLetter() {
  return useQuery({ queryKey: AI_STATE_QUERY_KEY, queryFn: fetchAiStateByLetter });
}
