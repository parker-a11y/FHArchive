/**
 * Meaning-based (vector) index for Ask Francis.
 *
 * Every research_index row is split into overlapping passages, embedded once
 * through the Lovable AI Gateway, and stored in `research_chunks`. Retrieval
 * then finds records by meaning, not by keyword luck — which is what keeps
 * Ask Francis honest as the archive grows past a thousand records.
 *
 * Server-only: the gateway key never leaves this module.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const EMBEDDING_MODEL = "google/gemini-embedding-2";
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 200;
const BATCH = 50;

/** Stable, cheap content fingerprint so unchanged passages are never re-embedded. */
function hashText(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + i, 2246822519) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}:${text.length}`;
}

function headerFor(row: any): string {
  return [
    `RECORD ${row.archive_id}${row.kind === "source" ? " (digital source)" : ""}`,
    row.title ? `Title: ${row.title}` : "",
    row.date_text || row.sort_date ? `Date: ${row.date_text || row.sort_date}` : "",
    row.author ? `Author: ${row.author}` : "",
    row.recipient ? `Recipient: ${row.recipient}` : "",
    row.origin ? `Written at: ${row.origin}` : "",
    (row.people ?? []).length ? `People: ${(row.people ?? []).join(", ")}` : "",
    (row.places ?? []).length ? `Places: ${(row.places ?? []).join(", ")}` : "",
    (row.keywords ?? []).length ? `Keywords: ${(row.keywords ?? []).join(", ")}` : "",
    row.summary ? `Summary: ${row.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export type RecordChunk = { content: string; page_label: string | null };

/** Last "[Page 2 front]" style marker at or before a position in the body. */
function pageLabelAt(body: string, position: number): string | null {
  const upto = body.slice(0, position + 1);
  const matches = upto.match(/\[([^\]\n]{1,40})\]/g);
  const last = matches?.[matches.length - 1];
  if (!last) return null;
  const label = last.slice(1, -1).trim();
  return /page|front|back|envelope|p\.?\s*\d/i.test(label) ? label : null;
}

/** Splits a record into overlapping passages, each prefixed with its record header. */
export function chunkRecord(row: any): RecordChunk[] {
  const header = headerFor(row);
  const body = String(row.body ?? "").trim();
  if (!body) return [{ content: header, page_label: null }];

  const out: RecordChunk[] = [];
  let start = 0;
  while (start < body.length) {
    let end = Math.min(start + CHUNK_CHARS, body.length);
    if (end < body.length) {
      // Prefer a sentence/paragraph boundary near the end of the window.
      const window = body.slice(start, end);
      const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "));
      if (cut > CHUNK_CHARS * 0.5) end = start + cut + 1;
    }
    out.push({
      content: `${header}\nPASSAGE:\n${body.slice(start, end).trim()}`,
      page_label: pageLabelAt(body, start),
    });
    if (end >= body.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return out;
}

/** Embeds a batch of strings through the gateway. Returns vectors in input order. */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return [];
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The research service is not configured on the server");

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: slice }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("The AI service is busy — try the refresh again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
      if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
      throw new Error(`Embedding request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: { index: number; embedding: number[] }[] };
    const rows = (json.data ?? []).slice().sort((a, b) => a.index - b.index);
    if (rows.length !== slice.length) throw new Error("The embedding service returned an incomplete batch");
    out.push(...rows.map((r) => r.embedding));
  }
  return out;
}

export type EmbedIndexResult = {
  records: number;
  chunks: number;
  embedded: number;
  reused: number;
  removed: number;
};

/**
 * Brings `research_chunks` in line with `research_index`. Incremental: a passage
 * whose text is unchanged keeps its existing vector, so a refresh after one new
 * letter costs one letter's worth of embedding.
 */
export async function rebuildResearchEmbeddings(admin: any): Promise<EmbedIndexResult> {
  // Load every indexed record (paged — never rely on the implicit 1,000-row cap).
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("research_index")
      .select(
        "kind, archive_id, title, record_type, sort_date, date_text, author, recipient, origin, people, places, organizations, keywords, summary, body",
      )
      .order("archive_id")
      .range(from, from + 999);
    if (error) throw new Error(`Could not read the research index: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const existing = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("research_chunks")
      .select("kind, archive_id, chunk_index, content_hash")
      .range(from, from + 999);
    if (error) throw new Error(`Could not read the meaning index: ${error.message}`);
    for (const c of data ?? []) existing.set(`${c.kind}:${c.archive_id}:${c.chunk_index}`, c.content_hash);
    if (!data || data.length < 1000) break;
  }

  const wanted = new Set<string>();
  const pending: Record<string, any>[] = [];
  let chunkTotal = 0;
  let reused = 0;

  for (const row of rows) {
    const chunks = chunkRecord(row);
    chunkTotal += chunks.length;
    chunks.forEach((chunk, chunk_index) => {
      const key = `${row.kind}:${row.archive_id}:${chunk_index}`;
      wanted.add(key);
      // The filter metadata is part of the fingerprint, so a metadata-only edit
      // (a new recipient, a corrected date) also refreshes the stored passage.
      const meta = {
        title: row.title ?? null,
        record_type: row.record_type ?? null,
        sort_date: row.sort_date ?? null,
        author: row.author ?? null,
        recipient: row.recipient ?? null,
        people: row.people ?? [],
        places: row.places ?? [],
        organizations: row.organizations ?? [],
        keywords: row.keywords ?? [],
        page_label: chunk.page_label,
      };
      const hash = hashText(`${chunk.content}\u0000${JSON.stringify(meta)}`);
      if (existing.get(key) === hash) {
        reused++;
        return;
      }
      pending.push({
        kind: row.kind,
        archive_id: row.archive_id,
        chunk_index,
        content: chunk.content,
        content_hash: hash,
        ...meta,
      });
    });
  }

  let embedded = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const vectors = await embedTexts(slice.map((p) => p.content));
    const payload = slice.map((p, n) => ({
      ...p,
      embedding: JSON.stringify(vectors[n]),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await admin
      .from("research_chunks")
      .upsert(payload as never, { onConflict: "kind,archive_id,chunk_index" });
    if (error) throw new Error(`Could not store the meaning index: ${error.message}`);
    embedded += slice.length;
  }

  // Drop passages for records (or trailing passages) that no longer exist.
  let removed = 0;
  const stale = Array.from(existing.keys()).filter((k) => !wanted.has(k));
  for (const key of stale) {
    const idx = key.lastIndexOf(":");
    const chunkIndex = Number(key.slice(idx + 1));
    const rest = key.slice(0, idx);
    const kind = rest.slice(0, rest.indexOf(":"));
    const archiveId = rest.slice(rest.indexOf(":") + 1);
    const { error } = await admin
      .from("research_chunks")
      .delete()
      .eq("kind", kind)
      .eq("archive_id", archiveId)
      .eq("chunk_index", chunkIndex);
    if (!error) removed++;
  }

  return { records: rows.length, chunks: chunkTotal, embedded, reused, removed };
}

/** Embeds a question and returns per-record semantic scores (best matching passage). */
export async function semanticRecordScores(
  admin: any,
  question: string,
  matchCount = 60,
): Promise<Map<string, { score: number; snippet: string }>> {
  const out = new Map<string, { score: number; snippet: string }>();
  try {
    const [vector] = await embedTexts([question]);
    if (!vector) return out;
    const { data, error } = await admin.rpc("match_research_chunks", {
      query_embedding: JSON.stringify(vector),
      match_count: matchCount,
    });
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const key = `${row.kind}:${row.archive_id}`;
      const score = Number(row.similarity ?? 0);
      const prev = out.get(key);
      if (!prev || score > prev.score) out.set(key, { score, snippet: String(row.content ?? "").slice(0, 600) });
    }
  } catch (e) {
    // Meaning search is an enhancement: keyword retrieval still answers the question.
    console.error("Semantic retrieval unavailable:", e);
  }
  return out;
}
