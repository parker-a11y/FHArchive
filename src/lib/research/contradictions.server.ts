/** Server-only: the one lens that needs judgement — a contradictions pass. */

/* eslint-disable @typescript-eslint/no-explicit-any */

const MODEL = process.env["RESEARCH_MODEL"] || "google/gemini-3.7-flash";

const SYSTEM = `You audit a private family history archive (The Francis Files) for internal contradictions.

You are given compact catalog metadata and summaries for archive records. Find places where the archive contradicts itself: impossible chronologies (a person in two places at once), conflicting dates for the same event, conflicting names or relationships, a stated origin that clashes with another record, or metadata that disagrees with a summary.

Rules:
- Only report a contradiction when at least two specific records disagree. Cite their record numbers.
- Never invent record numbers, people, places or dates.
- Ignore mere gaps or missing data — absence is not contradiction.
- Be concise and archival. If nothing genuinely conflicts, return an empty list.`;

export type Contradiction = {
  issue: string;
  detail: string;
  records: string[];
  confidence: string;
};

export async function findContradictions(
  compactRecords: string,
): Promise<{ items: Contradiction[]; model: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The research service is not configured on the server");
  if (!compactRecords.trim()) return { items: [], model: MODEL };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `ARCHIVE RECORDS\n${compactRecords}\n\nReturn a single JSON object:\n{ "items": [{ "issue": "short headline", "detail": "what conflicts and why it matters", "records": ["FH0042","FH0048"], "confidence": "confirmed | highly likely | probable | possible | uncertain" }] }`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("The research service is busy — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    throw new Error(`Contradictions pass failed (${res.status})`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (json.choices?.[0]?.message?.content ?? "").trim();
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: any = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) parsed = JSON.parse(cleaned.slice(start, end + 1));
  }

  const items: Contradiction[] = (Array.isArray(parsed.items) ? parsed.items : [])
    .map((i: any) => ({
      issue: String(i?.issue ?? "").trim(),
      detail: String(i?.detail ?? "").trim(),
      records: (Array.isArray(i?.records) ? i.records : [])
        .map((r: any) => String(r).trim().toUpperCase())
        .filter(Boolean),
      confidence: String(i?.confidence ?? "possible").trim().toLowerCase(),
    }))
    .filter((i: Contradiction) => i.issue);

  return { items, model: MODEL };
}
