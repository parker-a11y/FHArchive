import type { SupabaseClient } from "@supabase/supabase-js";
import { flowingCombinedTranscription, reflowCombinedFromPages } from "./transcription-format";

/** Reconstruct only page boundaries, never replace an independently edited roll-up. */
export async function readableRecordTranscription(db: SupabaseClient<any, "public", any>, letterId: string, input: string | null) {
  if (!input) return "";
  const [files, transcripts] = await Promise.all([
    db.from("digital_files").select("id, label, original_filename, include_in_transcription").eq("letter_id", letterId).order("sort_order", { ascending: true }),
    db.from("scan_transcriptions").select("file_id, page_index, verified_text, ai_text").eq("letter_id", letterId).order("page_index", { ascending: true }),
  ]);
  if (files.error || transcripts.error) return flowingCombinedTranscription(input);
  const pages = (files.data ?? [])
    .filter((f) => !/envelope/i.test(`${f.label ?? ""} ${f.original_filename ?? ""}`) || f.include_in_transcription)
    .flatMap((f) => (transcripts.data ?? []).filter((t) => t.file_id === f.id).map((t) => t.verified_text?.trim() ? String(t.verified_text) : String(t.ai_text ?? "")));
  return reflowCombinedFromPages(input, pages);
}