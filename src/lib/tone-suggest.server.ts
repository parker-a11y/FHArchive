import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only tone / sentiment suggestion. The model only proposes tones —
 * nothing is written to a record until the archivist confirms in the dialog.
 */

export const TONE_MODEL = "google/gemini-3.7-flash";

const SYSTEM_PROMPT = `You are an archival research assistant reading mid-20th-century family correspondence.

Identify the dominant emotional tones / sentiments of the letter — typically 1–3, the ones a reader would name first after finishing it. Be selective: more tones is not better, and a single tone is a perfectly good answer.

Rules:
- Suggest a tone only when it is sustained or central to the letter, not a passing mention. One wistful sentence in an otherwise chatty letter does not earn "Nostalgia".
- Prefer tones from the supplied EXISTING TONE LIST; reuse those labels exactly.
- Only propose a new tone when a clearly dominant sentiment has no reasonable match in the list. New tones must be short label form, e.g. "Faith / Religious Devotion".
- Ground every tone in the text. Never infer tone from metadata alone.`;

export type ToneSuggestion = { matched: string[]; proposed: string[] };

export async function suggestTonesForText(
  header: string,
  transcript: string,
  vocabulary: string[],
): Promise<ToneSuggestion> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured on the server");

  const prompt = `${SYSTEM_PROMPT}

EXISTING TONE LIST
${vocabulary.map((t) => `- ${t}`).join("\n")}

Return a single JSON object:
{"matched": ["tones copied exactly from the existing list"], "proposed": ["new tone labels not in the list"]}

RECORD METADATA
${header}

TRANSCRIBED TEXT
${transcript}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TONE_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limited by the AI service — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    if (res.status === 403)
      throw new Error("AI access is blocked for this workspace — check the AI settings.");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("The AI returned no tone suggestions");

  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("The AI response could not be read as JSON");
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const list = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  const known = new Map(vocabulary.map((t) => [t.toLowerCase(), t]));
  const matched: string[] = [];
  const proposed: string[] = [];

  for (const t of list(obj["matched"])) {
    const hit = known.get(t.toLowerCase());
    if (hit) matched.push(hit);
    else proposed.push(t);
  }
  for (const t of list(obj["proposed"])) {
    const hit = known.get(t.toLowerCase());
    if (hit) matched.push(hit);
    else proposed.push(t);
  }

  return {
    matched: Array.from(new Set(matched)),
    proposed: Array.from(new Set(proposed)).filter((t) => !matched.includes(t)),
  };
}

export async function loadToneContext(supabase: SupabaseClient, letterId: string) {
  const { buildAnalysisContext } = await import("./ai-analysis.server");
  return buildAnalysisContext(supabase, letterId);
}
