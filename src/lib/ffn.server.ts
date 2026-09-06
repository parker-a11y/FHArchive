/**
 * Server-only AI helpers for Francis File Notes. Drafts only — nothing the
 * model returns is ever published automatically.
 */

const MODEL = "google/gemini-3.7-flash";

export type FfnDraft = {
  term: string;
  expanded_name: string;
  category: string;
  aliases: string[];
  short_definition: string;
  background: string;
  archive_context: string;
  related_topics: string[];
  image_search_terms: string[];
  sources: string;
};

const SYSTEM = `You write encyclopedia entries for a private family history archive, The Francis Files: the wartime and family papers of Francis A. Harrington, a US Navy sailor who served in the Pacific aboard USS Doyle C. Barnes (DE-353) during World War II, with family in Worcester, Massachusetts.

You are given a term that appears in the archive. Write a short, accurate, plain reference entry a reader with no WWII knowledge can follow. Be factual and restrained; never invent specifics about the Harrington family, and say plainly when something is uncertain.`;

/** Ask the model for a draft note. `section` narrows the regeneration. */
export async function generateNoteDraft(input: {
  term: string;
  context?: string;
  existing?: Partial<FfnDraft>;
  section?: string;
}): Promise<Partial<FfnDraft>> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured on the server");

  const fields = input.section
    ? `Return only the key "${input.section}".`
    : `Return every key below.`;

  const prompt = `${SYSTEM}

TERM: ${input.term}
${input.context ? `WHERE IT APPEARS: ${input.context}` : ""}
${input.existing ? `CURRENT DRAFT (for reference, may be improved): ${JSON.stringify(input.existing)}` : ""}

Return a single JSON object. ${fields}
- "term": the canonical short form of the term
- "expanded_name": the full or expanded name, blank if there is none
- "category": one of person, place, ship, ship_type, military_term, navy_term, rank, organization, equipment, aircraft, vehicle, operation, historical_event, cultural_reference, slang, media, everyday_life, other
- "aliases": array of alternate spellings, abbreviations and expansions a reader might meet in a 1940s letter. Omit ambiguous everyday words.
- "short_definition": one or two sentences, plain language
- "background": two or three short paragraphs of historical background
- "archive_context": why this would come up in Francis's letters — the Pacific, escort duty, Navy routine, Worcester family life. Say "likely" or "typically" when inferring; never state invented facts as certain.
- "related_topics": array of 3-6 related concepts that deserve their own notes
- "image_search_terms": array of 2-4 phrases for finding a public-domain photograph
- "sources": short plain-text list of reputable sources or where to verify (e.g. Naval History and Heritage Command). No fabricated URLs.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limited by the AI service — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (json.choices?.[0]?.message?.content ?? "").trim();
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s === -1 || e <= s) throw new Error("The AI response could not be read");
    parsed = JSON.parse(cleaned.slice(s, e + 1));
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  return {
    term: str(parsed.term) || input.term,
    expanded_name: str(parsed.expanded_name),
    category: str(parsed.category) || "other",
    aliases: arr(parsed.aliases),
    short_definition: str(parsed.short_definition),
    background: str(parsed.background),
    archive_context: str(parsed.archive_context),
    related_topics: arr(parsed.related_topics),
    image_search_terms: arr(parsed.image_search_terms),
    sources: str(parsed.sources),
  };
}

export type ImageSuggestion = {
  url: string;
  thumb: string;
  title: string;
  credit: string;
  rights: string;
  sourceUrl: string;
};

/**
 * Finds candidate historical images on Wikimedia Commons (public, credited,
 * rights-labelled) for a note term. No API key needed.
 */
export async function searchNoteImages(query: string): Promise<ImageSuggestion[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "24",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "500",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "FrancisFilesArchive/1.0" },
  });
  if (!res.ok) throw new Error("Image search is unavailable right now");
  const json = (await res.json()) as {
    query?: { pages?: Record<string, Record<string, unknown>> };
  };
  const pages = Object.values(json.query?.pages ?? {});
  const plain = (v: unknown) =>
    typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim() : "";

  return pages
    .map((p) => {
      const info = (p["imageinfo"] as Array<Record<string, unknown>> | undefined)?.[0];
      if (!info) return null;
      const meta = (info["extmetadata"] as Record<{ toString(): string }, never> | undefined) as
        | Record<string, { value?: unknown }>
        | undefined;
      const url = String(info["url"] ?? "");
      if (!url) return null;
      return {
        url,
        thumb: String(info["thumburl"] ?? url),
        title: String(p["title"] ?? "").replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
        credit: plain(meta?.["Artist"]?.value) || "Wikimedia Commons",
        rights: plain(meta?.["LicenseShortName"]?.value),
        sourceUrl: String(info["descriptionurl"] ?? ""),
      };
    })
    .filter((x): x is ImageSuggestion => !!x);
}
