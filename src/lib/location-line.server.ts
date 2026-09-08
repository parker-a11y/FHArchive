import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAnalysisContext, ANALYSIS_MODEL } from "./ai-analysis.server";

/**
 * Server-only: asks the model for the Location Line — the place written at
 * the head of the letter (e.g. "Ft Schuyler", "Somewhere in the Pacific").
 * The result is stored ONLY in letters.dateline_suggested; the real Location
 * Line is written by an archivist who accepts or corrects it.
 */

const PROMPT = `You are reading a transcribed mid-20th-century family letter.

Find the LOCATION LINE: the place the writer wrote at the top (or dateline) of the letter, next to or near the date — for example "Ft Schuyler, N.Y.", "Somewhere in the Pacific", "U.S.S. Cabot", "Worcester". It is NOT the postmark, NOT the return address on an envelope, and NOT a place merely mentioned in the body.

Rules:
- Copy the wording exactly as written on the document (keep abbreviations).
- If the writer gave no location at the head of the letter, return an empty string.
- Never guess from the postmark or from the mailing origin metadata.

Return a JSON object: {"location_line": "..."}`;

export async function suggestLocationLine(
  supabase: SupabaseClient,
  letterId: string,
): Promise<{ suggestion: string | null; hasTranscript: boolean }> {
  const ctx = await buildAnalysisContext(supabase, letterId);
  if (!ctx.transcript) return { suggestion: null, hasTranscript: false };

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured on the server");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\nRECORD METADATA\n${ctx.header}\n\nTRANSCRIBED TEXT\n${ctx.transcript.slice(0, 20000)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limited by the AI service — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    throw new Error(`AI request failed (${res.status})`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (json.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?|```$/g, "").trim();
  let value = "";
  try {
    const parsed = JSON.parse(raw) as { location_line?: unknown };
    value = typeof parsed.location_line === "string" ? parsed.location_line.trim() : "";
  } catch {
    value = "";
  }
  value = value.replace(/\s*\n\s*/g, ", ").replace(/,\s*,/g, ",").trim();
  if (/^(none|n\/a|unknown|null)$/i.test(value)) value = "";
  return { suggestion: value, hasTranscript: true };
}

/** Writes the suggestion (empty string = checked, nothing found) without touching the real Location Line. */
export async function storeLocationLineSuggestion(
  supabase: SupabaseClient,
  letterId: string,
  suggestion: string,
) {
  const { error } = await supabase
    .from("letters")
    .update({ dateline_suggested: suggestion })
    .eq("id", letterId);
  if (error) throw new Error(error.message);
}
