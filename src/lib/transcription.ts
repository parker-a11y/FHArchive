import { supabase } from "@/integrations/supabase/client";

/**
 * AI OCR / transcription workflow.
 *
 * Archival rule: the uploaded master scan is never modified. Transcriptions
 * live in their own table, and the raw AI output is kept separately from the
 * human-corrected text so a correction can never destroy the AI result.
 */

export const SCAN_TRANSCRIPTION_STATUS = [
  { value: "not_started", label: "Not Transcribed" },
  { value: "processing", label: "Processing" },
  { value: "ai_transcribed", label: "AI Transcribed" },
  { value: "needs_review", label: "Needs Review" },
  { value: "human_verified", label: "Human Verified" },
  { value: "failed", label: "Failed" },
] as const;

export type ScanTranscriptionStatus = (typeof SCAN_TRANSCRIPTION_STATUS)[number]["value"];

export function transcriptionStatusLabel(value: string | null | undefined) {
  return SCAN_TRANSCRIPTION_STATUS.find((s) => s.value === value)?.label ?? "Not Transcribed";
}

export function transcriptionStatusTone(value: string | null | undefined) {
  switch (value) {
    case "human_verified":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "ai_transcribed":
      return "border-archive-ai/50 bg-archive-ai-surface text-foreground";
    case "needs_review":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "processing":
      return "border-sky-300 bg-sky-50 text-sky-800";
    case "failed":
      return "border-red-300 bg-red-50 text-red-800";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

export type ScanTranscription = {
  id: string;
  letter_id: string;
  file_id: string;
  page_label: string | null;
  page_index: number | null;
  ai_text: string | null;
  verified_text: string | null;
  status: string;
  model: string | null;
  error: string | null;
  ai_generated_at: string | null;
  verified_at: string | null;
  updated_at: string;
};

export async function fetchScanTranscriptions(letterId: string): Promise<ScanTranscription[]> {
  const { data, error } = await supabase
    .from("scan_transcriptions")
    .select("*")
    .eq("letter_id", letterId);
  if (error) throw error;
  return (data ?? []) as ScanTranscription[];
}

export async function saveCorrections(id: string, text: string, verified: boolean) {
  const patch: Record<string, unknown> = {
    verified_text: text || null,
    status: verified ? "human_verified" : "needs_review",
  };
  if (verified) patch["verified_at"] = new Date().toISOString();
  const { error } = await supabase.from("scan_transcriptions").update(patch as never).eq("id", id);
  if (error) throw error;
}

/** The transcription text that should be treated as authoritative. */
export function bestText(t: Pick<ScanTranscription, "ai_text" | "verified_text">) {
  return t.verified_text?.trim() ? t.verified_text : (t.ai_text ?? "");
}

/**
 * Envelope pages are deliberately kept out of the combined letter-body
 * transcription so postal text is never merged into the letter itself.
 */
export function isEnvelopePage(label: string | null | undefined, filename?: string | null) {
  const s = `${label ?? ""} ${filename ?? ""}`.toLowerCase();
  return s.includes("envelope");
}
