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

import { semanticPassages, type RetrievalFilters, type SemanticPassage } from "./embed.server";

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
  /** true when only metadata + matching passages are supplied, not the full text. */
  condensed?: boolean;
  /** Passage-level provenance: what was actually retrieved, and from where. */
  passages?: { text: string; page_label: string | null; score: number }[];
};

export type TermPresence = { term: string; count: number; records: string[] };

export type Corpus = {
  total: number;
  full: number;
  condensed: number;
  absent_terms: string[];
  present_terms: TermPresence[];
  /** Structured constraints inferred from the question, if any. */
  filters?: RetrievalFilters;
  /** How many passages the meaning search considered / how many were kept. */
  passages_considered?: number;
  passages_used?: number;
};

const SELECT =
  "kind, archive_id, title, record_type, subtype, period, sort_date, date_text, author, recipient, origin, destination, tones, keywords, people, places, events, organizations, linked_refs, summary, body";

/**
 * Budgets. The aim is the SMALLEST high-quality evidence set that answers the
 * question — not a full context window. FULL_TEXT_BUDGET is a safety ceiling,
 * never a target.
 */
const FULL_TEXT_CAP = 15000;
const FULL_TEXT_BUDGET = 300000;
const MAX_CONDENSED = 60;
/** How many passages the meaning search considers before ranking. */
const SEMANTIC_CANDIDATES = 150;
/** No single record may crowd the brief out with near-identical passages. */
const MAX_PASSAGES_PER_RECORD = 3;

type Shape = {
  /** Records supplied in full. */
  fullRecords: number;
  /** Passage-level evidence entries kept for other strong matches. */
  passages: number;
  broad: boolean;
};

const BROAD_HINTS =
  /\b(overall|throughout|across|every|all of|summar|theme|themes|trend|evolv|evolution|over time|pattern|whole archive|entire archive|timeline|how did .* change)\b/i;

/** Focused factual questions get a tight brief; synthesis questions get more. */
function shapeFor(question: string, terms: string[]): Shape {
  const broad = BROAD_HINTS.test(question) || terms.length > 14;
  return broad
    ? { fullRecords: 20, passages: 45, broad: true }
    : { fullRecords: 8, passages: 18, broad: false };
}

function questionTerms(question: string): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    ),
  ).slice(0, 50);
}

/**
 * Literal word check across the ENTIRE archive, not a shortlist. This is what
 * lets the answer say "no record uses that word" as a verified fact.
 */
export async function termPresence(admin: any, terms: string[]): Promise<TermPresence[]> {
  return Promise.all(
    terms.map(async (term) => {
      const like = `%${term.replace(/[%,]/g, " ")}%`;
      const filter = [
        `body.ilike.${like}`,
        `title.ilike.${like}`,
        `summary.ilike.${like}`,
        `archive_id.ilike.${like}`,
        `author.ilike.${like}`,
        `recipient.ilike.${like}`,
        `origin.ilike.${like}`,
        `destination.ilike.${like}`,
      ].join(",");
      const { data, count } = await admin
        .from("research_index")
        .select("archive_id", { count: "exact" })
        .or(filter)
        .limit(10);
      return {
        term,
        count: count ?? (data?.length ?? 0),
        records: (data ?? []).map((r: any) => String(r.archive_id)),
      };
    }),
  );
}

function snippetsFor(body: string, terms: string[], max = 2): string[] {
  const lower = body.toLowerCase();
  const out: string[] = [];
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i === -1) continue;
    out.push(`…${body.slice(Math.max(0, i - 300), i + 300).trim()}…`);
    if (out.length >= max) break;
  }
  return out;
}

function toEvidence(row: any, text: string, condensed: boolean): Evidence {
  return {
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
    text,
    condensed,
  };
}

// ------------------------------------------------------- structured filtering

const KIND_BY_WORD: Record<string, string[]> = {
  photograph: ["record"],
  photo: ["record"],
  letter: ["record"],
};
void KIND_BY_WORD;

/** Month names → 1-12, for date ranges written in prose. */
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function lastDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Dates read straight from the wording — no model, no guessing. */
function literalDateRange(question: string): { date_from?: string; date_to?: string } {
  const q = question.toLowerCase();
  const monthNames = Object.keys(MONTHS).join("|");
  const span = new RegExp(`(${monthNames})\\s*(?:through|to|-|–|until)\\s*(${monthNames})\\s+(\\d{4})`).exec(q);
  if (span) {
    const y = Number(span[3]);
    const m1 = MONTHS[span[1]!]!;
    const m2 = MONTHS[span[2]!]!;
    return {
      date_from: `${y}-${String(m1).padStart(2, "0")}-01`,
      date_to: `${y}-${String(m2).padStart(2, "0")}-${lastDay(y, m2)}`,
    };
  }
  const one = new RegExp(`(${monthNames})\\s+(\\d{4})`).exec(q);
  if (one) {
    const y = Number(one[2]);
    const m = MONTHS[one[1]!]!;
    return {
      date_from: `${y}-${String(m).padStart(2, "0")}-01`,
      date_to: `${y}-${String(m).padStart(2, "0")}-${lastDay(y, m)}`,
    };
  }
  const years = Array.from(new Set((q.match(/\b(19[0-9]{2}|20[0-9]{2})\b/g) ?? []).map(Number))).sort();
  if (years.length === 1) return { date_from: `${years[0]}-01-01`, date_to: `${years[0]}-12-31` };
  if (years.length >= 2) {
    return { date_from: `${years[0]}-01-01`, date_to: `${years[years.length - 1]}-12-31` };
  }
  return {};
}

/**
 * Reads structured constraints out of the question (date range, sender,
 * recipient, record type, person, place, ship/organization, keyword or note).
 * Anything the archive cannot confirm is dropped — a filter is never invented.
 */
export async function inferFilters(admin: any, question: string): Promise<RetrievalFilters> {
  const filters: RetrievalFilters = { ...literalDateRange(question) };

  let proposed: any = {};
  try {
    const raw = await callResearchModel(
      `You extract retrieval filters from a question about a private family archive of letters, photographs and documents.
Return ONLY constraints the question states explicitly or unmistakably implies. Leave a field null when unsure — a wrong filter hides evidence.
Return JSON: {"date_from":"YYYY-MM-DD|null","date_to":"YYYY-MM-DD|null","author":"sender name|null","recipient":"recipient name|null","record_types":["letter"|"photograph"|"document"|...]|null,"person":"name|null","place":"place name|null","organization":"ship or unit or organization name|null","keyword":"tag or note term|null"}`,
      question,
    );
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    proposed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1)) ?? {};
  } catch {
    proposed = {};
  }

  const str = (v: any) => {
    const s = String(v ?? "").trim();
    return s && s.toLowerCase() !== "null" ? s : null;
  };
  const isDate = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);

  if (!filters.date_from) filters.date_from = isDate(proposed.date_from);
  if (!filters.date_to) filters.date_to = isDate(proposed.date_to);

  /** Only keep a name/type filter the archive actually contains. */
  const confirm = async (column: string, value: string | null, array = false) => {
    if (!value) return null;
    const like = `%${value.replace(/[%,]/g, " ")}%`;
    const query = admin.from("research_index").select("archive_id", { count: "exact", head: true });
    const { count } = array
      ? await query.overlaps(column, [value])
      : await query.ilike(column, like);
    return (count ?? 0) > 0 ? value : null;
  };

  const [author, recipient, person, place, organization] = await Promise.all([
    confirm("author", str(proposed.author)),
    confirm("recipient", str(proposed.recipient)),
    confirm("people", str(proposed.person), true),
    confirm("places", str(proposed.place), true),
    confirm("organizations", str(proposed.organization), true),
  ]);
  filters.author = author;
  filters.recipient = recipient;
  filters.person = person;
  filters.place = place;
  filters.organization = organization;

  const types = Array.isArray(proposed.record_types)
    ? proposed.record_types.map((t: any) => str(t)).filter(Boolean)
    : [];
  if (types.length) {
    const { data } = await admin.from("research_index").select("record_type").in("record_type", types).limit(1);
    filters.record_types = (data ?? []).length ? types : null;
  }
  filters.keyword = await confirm("keywords", str(proposed.keyword), true);

  // Drop empty keys so the corpus report only shows real constraints.
  for (const key of Object.keys(filters) as (keyof RetrievalFilters)[]) {
    if (filters[key] == null || (Array.isArray(filters[key]) && !(filters[key] as string[]).length)) {
      delete filters[key];
    }
  }
  return filters;
}

/** Applies confirmed filters to a research_index query. */
function applyFilters(query: any, f: RetrievalFilters) {
  let q = query;
  if (f.date_from) q = q.gte("sort_date", f.date_from);
  if (f.date_to) q = q.lte("sort_date", f.date_to);
  if (f.author) q = q.ilike("author", `%${f.author}%`);
  if (f.recipient) q = q.ilike("recipient", `%${f.recipient}%`);
  if (f.record_types?.length) q = q.in("record_type", f.record_types);
  if (f.person) q = q.overlaps("people", [f.person]);
  if (f.place) q = q.overlaps("places", [f.place]);
  if (f.organization) q = q.overlaps("organizations", [f.organization]);
  if (f.keyword) q = q.overlaps("keywords", [f.keyword]);
  return q;
}

/**
 * Ranks the whole archive for a question — meaning search over passages,
 * full-text search, per-term keyword passes and directly named record numbers
 * all contribute — then builds the smallest strong brief: full text for the
 * best records, retrieved passages for other strong matches, and condensed
 * metadata entries beyond that.
 */
export async function retrieveEvidence(
  admin: any,
  question: string,
  filters: RetrievalFilters = {},
): Promise<{ evidence: Evidence[]; corpus: Corpus }> {
  const terms = questionTerms(question);
  const ftsQuery = terms.join(" or ");
  const shape = shapeFor(question, terms);

  // Record numbers named directly in the question are always included.
  const pinnedIds = Array.from(
    new Set(
      (question.toUpperCase().match(/\b(FH|DS)\s?-?\d{3,4}\b/g) ?? []).map((m) =>
        m.replace(/[\s-]/g, ""),
      ),
    ),
  );

  const hits = new Map<string, { row: any; score: number }>();
  const add = (rows: any[], weight: number) => {
    for (const row of rows ?? []) {
      const key = `${row.kind}:${row.archive_id}`;
      const existing = hits.get(key);
      if (existing) existing.score += weight;
      else hits.set(key, { row, score: weight });
    }
  };

  const { count: totalCount } = await admin
    .from("research_index")
    .select("archive_id", { count: "exact", head: true });
  const total = Math.max(totalCount ?? 0, 1);

  const [presence, passages] = await Promise.all([
    termPresence(admin, terms),
    semanticPassages(admin, question, filters, SEMANTIC_CANDIDATES),
  ]);

  // Group passages by record, keep only the strongest few per record so one
  // chatty letter cannot crowd out the rest of the archive.
  const byRecord = new Map<string, SemanticPassage[]>();
  for (const p of passages.slice().sort((a, b) => b.score - a.score)) {
    const key = `${p.kind}:${p.archive_id}`;
    const list = byRecord.get(key) ?? [];
    if (list.length >= MAX_PASSAGES_PER_RECORD) continue;
    list.push(p);
    byRecord.set(key, list);
  }

  if (ftsQuery) {
    const { data } = await applyFilters(
      admin.from("research_index").select(SELECT).textSearch("fts", ftsQuery, { type: "websearch" }),
      filters,
    ).limit(60);
    add(data ?? [], 3);

    // Per-term keyword pass, weighted so rare words outrank common ones.
    const passes = await Promise.all(
      terms.map(async (term) => {
        const like = `%${term.replace(/[%,]/g, " ")}%`;
        const { data: rows } = await applyFilters(
          admin
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
            ),
          filters,
        ).limit(60);
        return rows ?? [];
      }),
    );
    for (const rows of passes) {
      if (!rows.length) continue;
      // IDF: a word found in a handful of records counts far more than a ubiquitous one.
      const weight = 2 * Math.max(0.2, Math.log(total / rows.length));
      add(rows, weight);
    }
  }

  // Fold in the meaning matches: fetch any semantic hit not already retrieved.
  if (byRecord.size) {
    const missing = Array.from(byRecord.keys())
      .filter((k) => !hits.has(k))
      .map((k) => k.slice(k.indexOf(":") + 1));
    if (missing.length) {
      const { data } = await admin.from("research_index").select(SELECT).in("archive_id", missing);
      add(data ?? [], 0);
    }
    for (const [key, list] of byRecord) {
      const hit = hits.get(key);
      if (hit) hit.score += 8 * (list[0]?.score ?? 0);
    }
  }

  if (hits.size < 4) {
    const { data } = await applyFilters(admin.from("research_index").select(SELECT), filters)
      .order("sort_date", { ascending: true, nullsFirst: false })
      .limit(20);
    add(data ?? [], 1);
  }

  const pinnedRows: any[] = [];
  if (pinnedIds.length) {
    const { data } = await admin.from("research_index").select(SELECT).in("archive_id", pinnedIds);
    pinnedRows.push(...(data ?? []));
  }
  const pinnedKeys = new Set(pinnedRows.map((r) => `${r.kind}:${r.archive_id}`));

  const ranked = Array.from(hits.entries())
    .filter(([key]) => !pinnedKeys.has(key))
    .map(([, v]) => v)
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.row.sort_date ?? "").localeCompare(String(b.row.sort_date ?? "")) ||
        String(a.row.archive_id).localeCompare(String(b.row.archive_id)),
    )
    .map((h) => h.row);

  const ordered = [...pinnedRows, ...ranked];

  const evidence: Evidence[] = [];
  let budget = FULL_TEXT_BUDGET;
  let fullCount = 0;
  let passageCount = 0;
  let condensedCount = 0;

  for (const row of ordered) {
    const body = String(row.body ?? "");
    const key = `${row.kind}:${row.archive_id}`;
    const recordPassages = (byRecord.get(key) ?? []).map((p) => ({
      text: p.content.includes("PASSAGE:") ? p.content.slice(p.content.indexOf("PASSAGE:") + 8).trim() : p.content,
      page_label: p.page_label,
      score: Number(p.score.toFixed(4)),
    }));

    // 1. Strongest records: the full text, so nothing is read out of context.
    if (fullCount < shape.fullRecords) {
      const full = body.slice(0, FULL_TEXT_CAP);
      if (budget - full.length >= 0) {
        budget -= full.length;
        fullCount++;
        const e = toEvidence(row, full, false);
        if (recordPassages.length) e.passages = recordPassages;
        evidence.push(e);
        continue;
      }
    }

    // 2. Other strong matches: only the passages actually retrieved.
    if (recordPassages.length && passageCount < shape.passages) {
      passageCount += recordPassages.length;
      const e = toEvidence(row, recordPassages.map((p) => (p.page_label ? `[${p.page_label}] ${p.text}` : p.text)).join("\n\n…\n\n"), true);
      e.passages = recordPassages;
      evidence.push(e);
      continue;
    }

    // 3. Everything else that matched: metadata plus keyword snippets.
    if (condensedCount >= MAX_CONDENSED) break;
    condensedCount++;
    const snips = snippetsFor(body, terms);
    evidence.push(toEvidence(row, snips.length ? snips.join("\n\n") : body.slice(0, 400), true));
  }

  return {
    evidence,
    corpus: {
      total,
      full: fullCount,
      condensed: evidence.length - fullCount,
      absent_terms: presence.filter((p) => p.count === 0).map((p) => p.term),
      present_terms: presence.filter((p) => p.count > 0),
      filters: Object.keys(filters).length ? filters : undefined,
      passages_considered: passages.length,
      passages_used: passageCount,
    },
  };
}


// ----------------------------------------------------------------- generation

// ------------------------------------------------- outside historical context

export type WebSource = { title: string; url: string; note: string };

/**
 * Decides whether a question needs historical background beyond the archive, and
 * what to search for. Archive-only questions skip the web entirely.
 */
async function planExternalResearch(question: string): Promise<string[]> {
  try {
    const raw = await callResearchModel(
      `You triage research questions for a private family-history archive (mid-20th-century American family, WWII and postwar).
Decide whether answering well would benefit from general historical background OUTSIDE the family's own papers — a place, hotel, ship, military unit, battle, product, custom, price, or period detail.
Questions purely about what the family's records contain (who wrote what, when, where a record is) do NOT need outside research.
Return JSON: {"needed": true|false, "queries": ["at most two short web search queries"]}`,
      question,
    );
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    if (!parsed?.needed) return [];
    return (Array.isArray(parsed.queries) ? parsed.queries : [])
      .map((q: any) => String(q).trim())
      .filter(Boolean)
      .slice(0, 2);
  } catch {
    return [];
  }
}

/** Real web research via Perplexity. Returns [] when the connector is not linked. */
async function searchOutsideHistory(
  queries: string[],
): Promise<{ text: string; sources: WebSource[] }> {
  const key = process.env["PERPLEXITY_API_KEY"];
  if (!key || !queries.length) return { text: "", sources: [] };

  const runs = await Promise.all(
    queries.map(async (query) => {
      try {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              {
                role: "system",
                content:
                  "You are a historical reference desk. Answer factually and concisely, with dates and specifics. If sources disagree or are thin, say so. Never speculate.",
              },
              { role: "user", content: query },
            ],
          }),
        });
        if (!res.ok) {
          console.error(`Perplexity request failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
          return null;
        }
        const json: any = await res.json();
        const content = String(json?.choices?.[0]?.message?.content ?? "").trim();
        const urls: string[] = Array.isArray(json?.citations)
          ? json.citations.map((c: any) => (typeof c === "string" ? c : c?.url)).filter(Boolean)
          : (json?.search_results ?? []).map((r: any) => r?.url).filter(Boolean);
        const titles: Record<string, string> = {};
        for (const r of json?.search_results ?? []) if (r?.url) titles[r.url] = String(r.title ?? "");
        return { query, content, urls: urls.slice(0, 6), titles };
      } catch (e) {
        console.error("Perplexity lookup failed:", e);
        return null;
      }
    }),
  );

  const sources: WebSource[] = [];
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const run of runs) {
    if (!run || !run.content) continue;
    blocks.push(`OUTSIDE RESEARCH — "${run.query}"\n${run.content}\nSOURCE URLS:\n${run.urls.join("\n")}`);
    for (const url of run.urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      let host = url;
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        /* keep raw */
      }
      sources.push({ title: run.titles[url] || host, url, note: run.query });
    }
  }
  return { text: blocks.join("\n\n---\n\n").slice(0, 30000), sources };
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
  citations: { archive_id: string; note: string; confidence: string; page?: string | null }[];
  sources: WebSource[];
  follow_ups: string[];
  caveats: string;
  evidence: Evidence[];
  corpus: Corpus;
  model: string;
};

const SYSTEM = `You are "Ask Francis", the research assistant for a private family history archive (The Francis Files: mid-20th-century American family, wartime and postwar material).

The archive is the foundation of every answer. You may also draw on the OUTSIDE RESEARCH supplied to you for general historical context, so long as it is sourced.

The evidence you receive covers the WHOLE archive. Every record was searched — by meaning, by full text, and word by word. The strongest matches are supplied in full; the rest appear as condensed entries (metadata, summary and matching passages). A condensed entry is still a real record: cite it, but do not claim to have read text you were not shown.

The TERM PRESENCE block is a verified count over every record in the archive. When it reports a word as VERIFIED ABSENT, state plainly that the word appears nowhere in the archive — that is a definite finding, not a limitation of retrieval. Never write "not in the retrieved set", "not among the records retrieved", or any similar hedge: nothing was withheld from the search.

Two tiers of evidence, never blurred:
1. ARCHIVE EVIDENCE — what the family's records show. Cite FH record numbers (e.g. FH0042) inline for every archive statement. Never state an archive conclusion without at least one FH citation.
2. HISTORICAL CONTEXT — general history from the supplied outside research. Mark each such statement inline as outside the archive, e.g. "(general history: the Hollywood Hotel's Thursday-night dinner dances drew studio crowds through the 1930s — [source])", and cite the source URL it came from.

Absolute rules:
- Never invent quotations. Never invent records, FH numbers, people, places, ships, units, dates or events.
- Never present historical background as if researched when no outside research was supplied. If none was supplied and the question needs it, say plainly that the archive alone cannot answer that part and what would settle it.
- Only cite source URLs that appear in the supplied OUTSIDE RESEARCH. Never fabricate a link, publication or author.
- Distinguish clearly between (a) what a document actually says, (b) what the catalog metadata records, (c) sourced outside history, and (d) your own inference. Label inferences in the prose, e.g. "probable — FH0048 was forwarded to Miami".
- Do not build a narrative to cover a gap. A gap stated plainly is a better answer than a plausible story.
- If the question names a record number that does not appear in the supplied ARCHIVE EVIDENCE, say plainly and up front that the record was not in the retrieved set, and do not reason around it with substitute records unless the researcher asked for related material.
- Use one of these confidence words when characterising a conclusion: confirmed, highly likely, probable, possible, uncertain. Confidence describes the ARCHIVE conclusion, not the background.
- Be concise and archival in tone. Markdown is allowed: short paragraphs, bullets, bold for FH numbers where helpful.

You are producing research findings, not catalog data. Nothing you say updates the archive.`;


export async function answerResearchQuestion(
  admin: any,
  question: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<ResearchAnswer> {
  // Structured constraints stated in the question narrow retrieval; anything the
  // archive cannot confirm is dropped rather than guessed at.
  const filters = await inferFilters(admin, question);
  const [{ evidence, corpus }, queries] = await Promise.all([
    retrieveEvidence(admin, question, filters),
    planExternalResearch(question),
  ]);
  const outside = await searchOutsideHistory(queries);


  const evidenceText = evidence
    .map((e) => {
      const meta = [
        `RECORD ${e.archive_id}${e.kind === "source" ? " (digital source)" : ""}`,
        e.title ? `Title: ${e.title}` : "",
        e.record_type ? `Type: ${e.record_type}` : "",
        e.date ? `Date: ${e.date}` : "",
        e.author ? `Author: ${e.author}` : "",
        e.recipient ? `Recipient: ${e.recipient}` : "",
        e.origin ? `Written at / origin: ${e.origin}` : "",
        e.destination ? `Destination: ${e.destination}` : "",
        e.people.length ? `People: ${e.people.join(", ")}` : "",
        e.places.length ? `Places: ${e.places.join(", ")}` : "",
        e.events.length ? `Events: ${e.events.join(", ")}` : "",
        e.keywords.length ? `Keywords: ${e.keywords.join(", ")}` : "",
        e.tones.length ? `Tones: ${e.tones.join(", ")}` : "",
        e.summary ? `Summary: ${e.summary}` : "",
        e.passages?.some((p) => p.page_label)
          ? `Matching passages come from: ${Array.from(
              new Set(e.passages.filter((p) => p.page_label).map((p) => p.page_label)),
            ).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      return `${meta}\n${e.condensed ? "CONDENSED ENTRY (metadata + matching passages only)" : "TEXT"}:\n${e.text}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 400000);

  const historyText = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "Researcher" : "Ask Francis"}: ${h.content}`)
    .join("\n\n");

  const presenceText = [
    ...corpus.present_terms.map(
      (p) =>
        `"${p.term}" — appears in ${p.count} record${p.count === 1 ? "" : "s"}${
          p.records.length ? ` (e.g. ${p.records.join(", ")})` : ""
        }`,
    ),
    ...corpus.absent_terms.map((t) => `"${t}" — VERIFIED ABSENT: appears in no record in the archive`),
  ].join("\n");

  const prompt = `${historyText ? `EARLIER IN THIS RESEARCH THREAD\n${historyText}\n\n` : ""}RESEARCH QUESTION
${question}

ARCHIVE SCOPE
The archive holds ${corpus.total} indexed records. All ${corpus.total} were searched for this question — by meaning, by full text, and word by word. ${corpus.full} are supplied below in full; ${corpus.condensed} are supplied as condensed entries (metadata, summary and the passages matching this question). No record was excluded from the search.

TERM PRESENCE (checked against all ${corpus.total} records, not just those supplied)
${presenceText || "(no distinctive terms in this question)"}

ARCHIVE EVIDENCE
${evidenceText || "(no matching records were found in the archive)"}

${
  outside.text
    ? `OUTSIDE RESEARCH (general history, from web sources — cite only these URLs)\n${outside.text}`
    : "OUTSIDE RESEARCH\n(none was gathered for this question — do not supply unsourced historical background)"
}

Return a single JSON object:
{
  "answer": "Markdown answer with inline FH citations, and inline labelled historical context where useful",
  "confidence": "confirmed | highly likely | probable | possible | uncertain",
  "citations": [{ "archive_id": "FH0042", "note": "what this record contributes", "confidence": "confirmed" }],
  "sources": [{ "title": "page or site name", "url": "https://... (must appear in OUTSIDE RESEARCH)", "note": "what this source supports" }],
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

  // Never surface a link the search pass did not actually return.
  const allowedUrls = new Map(outside.sources.map((s) => [s.url, s]));
  const sources: WebSource[] = (Array.isArray(parsed.sources) ? parsed.sources : [])
    .map((s: any) => {
      const url = String(s?.url ?? "").trim();
      const known = allowedUrls.get(url);
      if (!known) return null;
      return { title: String(s?.title ?? "").trim() || known.title, url, note: String(s?.note ?? "").trim() };
    })
    .filter(Boolean) as WebSource[];

  const confidence = String(parsed.confidence ?? "possible").toLowerCase();
  return {
    answer: String(parsed.answer ?? "").trim() || "No answer was produced for this question.",
    confidence: (CONFIDENCE_LEVELS as readonly string[]).includes(confidence)
      ? (confidence as ResearchAnswer["confidence"])
      : "possible",
    citations,
    sources,

    follow_ups: (Array.isArray(parsed.follow_ups) ? parsed.follow_ups : [])
      .map((f: any) => String(f).trim())
      .filter(Boolean)
      .slice(0, 4),
    caveats: String(parsed.caveats ?? "").trim(),
    evidence,
    corpus,
    model: MODEL,
  };
}
