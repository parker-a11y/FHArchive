/**
 * The research agent (server-only).
 *
 * Ask Francis never talks to a model vendor directly: it talks to this module.
 * Retrieval (research index) and generation (chat model) are separate, and the
 * model provider sits behind `callResearchModel`, so swapping OpenAI /
 * Anthropic / Google later means editing one function, not the UI.
 *
 * The agent is strictly read-only: it retrieves evidence and produces findings.
 * Nothing here writes to archival tables.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ResearchProvider = "lovable-gateway";

const PROVIDER = (process.env["RESEARCH_PROVIDER"] as ResearchProvider) || "lovable-gateway";
const MODEL = process.env["RESEARCH_MODEL"] || "google/gemini-3.7-flash";

/** Single point of contact with whichever model provider is configured. */
async function callResearchModel(system: string, prompt: string): Promise<string> {
  if (PROVIDER !== "lovable-gateway") throw new Error(`Unknown research provider: ${PROVIDER}`);
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The research service is not configured on the server");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("The research service is busy — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
    throw new Error(`Research request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

// ------------------------------------------------------------------ retrieval

const STOPWORDS = new Set(
  "a an and are as at be but by can could did do does for from had has have he her his how i in is it its me my of on or our she should show so tell that the their them there these they this to was we were what when where which who whom why will with would you your find list about during".split(
    " ",
  ),
);

export type Evidence = {
  archive_id: string;
  kind: string;
  title: string | null;
  date: string | null;
  record_type: string | null;
  author: string | null;
  recipient: string | null;
  origin: string | null;
  destination: string | null;
  people: string[];
  places: string[];
  events: string[];
  keywords: string[];
  tones: string[];
  summary: string | null;
  text: string;
};

const SELECT =
  "kind, archive_id, title, record_type, subtype, period, sort_date, date_text, author, recipient, origin, destination, tones, keywords, people, places, events, organizations, linked_refs, summary, body";

/**
 * Retrieves the most relevant records for a question: full-text search first,
 * then keyword fallback, then a recency backstop. Only the retrieved evidence
 * is sent to the model — never the whole archive.
 */
export async function retrieveEvidence(
  admin: any,
  question: string,
  limit = 14,
): Promise<Evidence[]> {
  const terms = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const hits = new Map<string, { row: any; score: number }>();
  const add = (rows: any[], weight: number) => {
    for (const row of rows ?? []) {
      const key = `${row.kind}:${row.archive_id}`;
      const existing = hits.get(key);
      if (existing) existing.score += weight;
      else hits.set(key, { row, score: weight });
    }
  };

  if (terms.length) {
    const { data } = await admin
      .from("research_index")
      .select(SELECT)
      .textSearch("fts", terms.join(" or "), { type: "websearch" })
      .limit(60);
    add(data ?? [], 3);

    // Per-term keyword pass so distinctive proper nouns rank higher.
    for (const term of terms.slice(0, 8)) {
      const like = `%${term.replace(/[%,]/g, " ")}%`;
      const { data: rows } = await admin
        .from("research_index")
        .select(SELECT)
        .or(
          [
            `body.ilike.${like}`,
            `title.ilike.${like}`,
            `summary.ilike.${like}`,
            `archive_id.ilike.${like}`,
            `author.ilike.${like}`,
            `recipient.ilike.${like}`,
            `origin.ilike.${like}`,
            `destination.ilike.${like}`,
          ].join(","),
        )
        .limit(40);
      add(rows ?? [], 2);
    }
  }

  if (hits.size < 4) {
    const { data } = await admin
      .from("research_index")
      .select(SELECT)
      .order("sort_date", { ascending: true, nullsFirst: false })
      .limit(limit);
    add(data ?? [], 1);
  }

  return Array.from(hits.values())
    .sort((a, b) => b.score - a.score || String(a.row.archive_id).localeCompare(String(b.row.archive_id)))
    .slice(0, limit)
    .map(({ row }) => ({
      archive_id: row.archive_id,
      kind: row.kind,
      title: row.title,
      date: row.date_text || row.sort_date || null,
      record_type: row.record_type,
      author: row.author,
      recipient: row.recipient,
      origin: row.origin,
      destination: row.destination,
      people: row.people ?? [],
      places: row.places ?? [],
      events: row.events ?? [],
      keywords: row.keywords ?? [],
      tones: row.tones ?? [],
      summary: row.summary,
      text: String(row.body ?? "").slice(0, 12000),
    }));
}

// ----------------------------------------------------------------- generation

export const CONFIDENCE_LEVELS = [
  "confirmed",
  "highly likely",
  "probable",
  "possible",
  "uncertain",
] as const;

export type ResearchAnswer = {
  answer: string;
  confidence: (typeof CONFIDENCE_LEVELS)[number];
  citations: { archive_id: string; note: string; confidence: string }[];
  follow_ups: string[];
  caveats: string;
  evidence: Evidence[];
  model: string;
};

const SYSTEM = `You are "Ask Francis", the research assistant for a private family history archive (The Francis Files: mid-20th-century American family, wartime and postwar material).

You answer research questions using ONLY the archive evidence supplied to you.

Absolute rules:
- Cite FH record numbers (e.g. FH0042) inline in your answer for every factual statement. Never state an archive conclusion without at least one citation.
- Never invent records, FH numbers, people, places, ships, dates or quotations.
- Distinguish clearly between (a) what a document actually says, (b) what the catalog metadata records, and (c) your own inference. Label inferences in the prose, e.g. "probable — FH0048 was forwarded to Miami".
- Use one of these confidence words when characterising a conclusion: confirmed, highly likely, probable, possible, uncertain.
- If the evidence does not answer the question, say so plainly and suggest what would settle it. Do not fill gaps with plausible narrative.
- Be concise and archival in tone. Markdown is allowed: short paragraphs, bullets, bold for FH numbers where helpful.

You are producing research findings, not catalog data. Nothing you say updates the archive.`;

export async function answerResearchQuestion(
  admin: any,
  question: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<ResearchAnswer> {
  const evidence = await retrieveEvidence(admin, question);

  const evidenceText = evidence
    .map((e) => {
      const meta = [
        `RECORD ${e.archive_id}${e.kind === "source" ? " (digital source)" : ""}`,
        e.title ? `Title: ${e.title}` : "",
        e.record_type ? `Type: ${e.record_type}` : "",
        e.date ? `Date: ${e.date}` : "",
        e.author ? `Author: ${e.author}` : "",
        e.recipient ? `Recipient: ${e.recipient}` : "",
        e.origin ? `Origin: ${e.origin}` : "",
        e.destination ? `Destination: ${e.destination}` : "",
        e.people.length ? `People: ${e.people.join(", ")}` : "",
        e.places.length ? `Places: ${e.places.join(", ")}` : "",
        e.events.length ? `Events: ${e.events.join(", ")}` : "",
        e.keywords.length ? `Keywords: ${e.keywords.join(", ")}` : "",
        e.tones.length ? `Tones: ${e.tones.join(", ")}` : "",
        e.summary ? `Summary: ${e.summary}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return `${meta}\nTEXT:\n${e.text}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 180000);

  const historyText = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "Researcher" : "Ask Francis"}: ${h.content}`)
    .join("\n\n");

  const prompt = `${historyText ? `EARLIER IN THIS RESEARCH THREAD\n${historyText}\n\n` : ""}RESEARCH QUESTION
${question}

ARCHIVE EVIDENCE (${evidence.length} records retrieved from the research index)
${evidenceText || "(no matching records were found in the archive)"}

Return a single JSON object:
{
  "answer": "Markdown answer with inline FH citations",
  "confidence": "confirmed | highly likely | probable | possible | uncertain",
  "citations": [{ "archive_id": "FH0042", "note": "what this record contributes", "confidence": "confirmed" }],
  "follow_ups": ["two or three sharper follow-up research questions"],
  "caveats": "what the archive does not show, or where the reading is shaky (may be empty)"
}`;

  const raw = await callResearchModel(SYSTEM, prompt);
  if (!raw) throw new Error("The research service returned no answer");

  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("The research answer could not be read");
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }

  const known = new Set(evidence.map((e) => e.archive_id));
  const citations = (Array.isArray(parsed.citations) ? parsed.citations : [])
    .map((c: any) => ({
      archive_id: String(c?.archive_id ?? "").trim().toUpperCase(),
      note: String(c?.note ?? "").trim(),
      confidence: String(c?.confidence ?? "").trim().toLowerCase(),
    }))
    // Never surface a citation to a record the retriever did not actually supply.
    .filter((c: any) => c.archive_id && known.has(c.archive_id));

  const confidence = String(parsed.confidence ?? "possible").toLowerCase();
  return {
    answer: String(parsed.answer ?? "").trim() || "No answer was produced for this question.",
    confidence: (CONFIDENCE_LEVELS as readonly string[]).includes(confidence)
      ? (confidence as ResearchAnswer["confidence"])
      : "possible",
    citations,
    follow_ups: (Array.isArray(parsed.follow_ups) ? parsed.follow_ups : [])
      .map((f: any) => String(f).trim())
      .filter(Boolean)
      .slice(0, 4),
    caveats: String(parsed.caveats ?? "").trim(),
    evidence,
    model: MODEL,
  };
}
