import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only helpers for AI record analysis. The archive key never leaves the
 * server: requests go out through the Lovable AI Gateway.
 *
 * The model never writes archival metadata — its output is stored as pending
 * suggestions that the archivist reviews.
 */

export const ANALYSIS_MODEL = "google/gemini-3.7-flash";

/** Field keys the model is asked to fill; mirrors AI_FIELDS in archive.ts. */
export const ANALYSIS_FIELDS = [
  ["summary_short", "One or two sentences summarising the record."],
  ["summary_long", "A fuller paragraph summary: content, context, tone, significance."],
  ["keywords", "Comma-separated subject keywords (what the record is about)."],
  ["people", "Comma-separated names of people mentioned, as written in the document."],
  ["places", "Comma-separated place names mentioned."],
  ["units", "Comma-separated military units mentioned."],
  ["ships", "Comma-separated ships mentioned."],
  ["organizations", "Comma-separated organizations, schools, employers, churches mentioned."],
  ["events", "Comma-separated historical or family events referenced."],
  ["quotations", "Notable quotations, one per line, quoted verbatim."],
  ["uncertain", "Passages that appear misread or illegible, one per line."],
  ["questions", "Research questions this record raises, one per line."],
  ["related", "Other records or correspondence this one appears to relate to, one per line."],
] as const;

export type AnalysisContext = {
  letterId: string;
  header: string;
  transcript: string;
};

/** Gathers the record's catalog fields and best available transcription text. */
export async function buildAnalysisContext(
  supabase: SupabaseClient,
  letterId: string,
): Promise<AnalysisContext> {
  const { data: letter, error } = await supabase
    .from("letters")
    .select(
      "id, archive_id, record_type, subtype, title, date_as_written, normalized_date, period, author, recipient, origin, destination, primary_person, physical_description, notes, transcription_verified, transcription_raw_ai, ocr_text",
    )
    .eq("id", letterId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!letter) throw new Error("Record not found");

  const { data: pages } = await supabase
    .from("scan_transcriptions")
    .select("page_label, page_index, ai_text, verified_text")
    .eq("letter_id", letterId)
    .order("page_index");

  const pageText = (pages ?? [])
    .map((p, i) => {
      const text = (p.verified_text ?? p.ai_text ?? "").trim();
      if (!text) return "";
      return `--- Page ${i + 1}${p.page_label ? ` (${p.page_label})` : ""} ---\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const transcript = (
    letter.transcription_verified?.trim() ||
    pageText ||
    letter.transcription_raw_ai?.trim() ||
    letter.ocr_text?.trim() ||
    ""
  ).slice(0, 60000);

  const headerLines = [
    `Archive ID: ${letter.archive_id}`,
    letter.record_type ? `Record type: ${letter.record_type}` : "",
    letter.subtype ? `Subtype: ${letter.subtype}` : "",
    letter.title ? `Title: ${letter.title}` : "",
    letter.date_as_written ? `Date as written: ${letter.date_as_written}` : "",
    letter.normalized_date ? `Normalized date: ${letter.normalized_date}` : "",
    letter.period ? `Period: ${letter.period}` : "",
    letter.author ? `Author: ${letter.author}` : "",
    letter.recipient ? `Recipient: ${letter.recipient}` : "",
    letter.origin ? `Origin: ${letter.origin}` : "",
    letter.destination ? `Destination: ${letter.destination}` : "",
    letter.primary_person ? `Primary person: ${letter.primary_person}` : "",
    letter.physical_description ? `Physical description: ${letter.physical_description}` : "",
    letter.notes ? `Archivist notes: ${letter.notes}` : "",
  ].filter(Boolean);

  return { letterId, header: headerLines.join("\n"), transcript };
}

const SYSTEM_PROMPT = `You are an archival research assistant working on a private family history archive (the Harrington collection, mid-20th-century American family and wartime material).

Analyse the supplied record and return suggestions for a human archivist to review. You are not writing the catalog: every suggestion is reviewed before it is kept.

Rules:
- Ground everything in the supplied text. Never invent people, places, ships, units, events, or dates.
- Use names and spellings exactly as they appear in the document.
- Leave a field as an empty string when the record gives no reliable basis for it.
- Do not speculate about identities; if a reading is uncertain, say so in the "uncertain" field.
- Keep list fields concise: comma-separated values, no numbering, no commentary.`;

/** Calls the gateway and returns a field-key -> suggestion map. */
export async function analyzeRecordText(ctx: AnalysisContext): Promise<Record<string, string>> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured on the server");

  const fieldSpec = ANALYSIS_FIELDS.map(([k, d]) => `- "${k}": ${d}`).join("\n");
  const prompt = `${SYSTEM_PROMPT}

Return a single JSON object with exactly these string keys:
${fieldSpec}

RECORD METADATA
${ctx.header}

TRANSCRIBED TEXT
${ctx.transcript}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
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
  if (!raw) throw new Error("The AI returned no analysis");

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
  const out: Record<string, string> = {};
  for (const [key] of ANALYSIS_FIELDS) {
    const v = obj[key];
    const text = Array.isArray(v)
      ? v.map(String).join(", ")
      : typeof v === "string"
        ? v
        : v == null
          ? ""
          : String(v);
    const trimmed = text.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}
