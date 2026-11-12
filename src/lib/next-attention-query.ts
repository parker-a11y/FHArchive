import { supabase } from "@/integrations/supabase/client";
import { nextAttentionRecord } from "./next-attention";

/** Fresh, narrow reads under the viewer's existing archive permissions. */
export async function fetchNextAttentionRecord(currentSequence: number) {
  let before = currentSequence;
  for (;;) {
    const { data: records, error } = await supabase.from("letters")
      .select("id,fh_seq,archive_id,record_type,scan_status,transcription_status")
      .lt("fh_seq", before).neq("record_type", "moved_to_gallery")
      .order("fh_seq", { ascending: false }).limit(50);
    if (error) throw error;
    if (!records?.length) return null;
    const ai: Record<string, { total: number; pending: number }> = {};
    for (let from = 0; ; from += 1000) {
      const { data: suggestions, error: aiError } = await supabase.from("ai_suggestions")
        .select("letter_id,status").in("letter_id", records.map((r) => r.id))
        .order("id").range(from, from + 999);
      if (aiError) throw aiError;
      for (const suggestion of suggestions ?? []) {
        const state = ai[suggestion.letter_id] ??= { total: 0, pending: 0 };
        state.total++;
        if (suggestion.status === "pending") state.pending++;
      }
      if ((suggestions?.length ?? 0) < 1000) break;
    }
    const next = nextAttentionRecord(currentSequence, records, ai);
    if (next) return next.archive_id;
    const last = records.at(-1);
    if (!last || records.length < 50) return null;
    before = last.fh_seq;
  }
}