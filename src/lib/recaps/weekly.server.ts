/**
 * Weekly Francis Files Recap (server-only).
 *
 * Reads ONLY existing archival structures (letters, digital sources,
 * transcriptions, AI suggestions, the research index, previous recaps) and
 * turns one week of archival work into a short narrative page. It never writes
 * to any catalog table — the single write is the recap row itself.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const MODEL = process.env["RECAP_MODEL"] || process.env["RESEARCH_MODEL"] || "google/gemini-3.7-flash";

// ------------------------------------------------------------------- helpers

/** Weeks run Sunday → Saturday, matching the Sunday 2:00 AM schedule. */
export function weekBounds(reference: Date, previous: boolean) {
  const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // Sunday of the reference week
  if (previous) d.setUTCDate(d.getUTCDate() - 7);
  const start = d;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { weekStart: iso(start), weekEnd: iso(end) };
}

export function formatRange(weekStart: string, weekEnd: string) {
  const fmt = (s: string, withYear: boolean) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      ...(withYear ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    });
  const sameYear = weekStart.slice(0, 4) === weekEnd.slice(0, 4);
  return `${fmt(weekStart, !sameYear)} – ${fmt(weekEnd, true)}`;
}

async function callModel(system: string, prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The recap service is not configured on the server");
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
    if (res.status === 429) throw new Error("The AI service is busy — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
    throw new Error(`Recap generation failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

function parseJson(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("The recap could not be read");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

// ----------------------------------------------------------------- gathering

type WeekMaterial = {
  letters: any[];
  sources: any[];
  quotes: { archive_id: string; text: string }[];
  indexRows: any[];
  counts: Record<string, number>;
  image: { bucket: string; path: string; archive_id: string; caption: string } | null;
  archiveIds: string[];
};

async function gatherWeek(admin: any, weekStart: string, weekEnd: string): Promise<WeekMaterial> {
  const from = `${weekStart}T00:00:00Z`;
  const to = `${weekEnd}T23:59:59Z`;
  const touched = (q: any) => q.or(`and(created_at.gte.${from},created_at.lte.${to}),and(updated_at.gte.${from},updated_at.lte.${to})`);

  const [{ data: letters }, { data: sources }, { data: transcriptions }, { data: files }, { data: suggestions }] =
    await Promise.all([
      touched(
        admin
          .from("letters")
          .select(
            "id, archive_id, title, record_type, subtype, period, date_as_written, normalized_date, sort_date, author, recipient, origin, destination, tones, starred, summary_short, summary_long, historical_notes, research_notes, transcription_status, created_at, updated_at",
          ),
      ).order("fh_seq", { ascending: true }).limit(120),
      touched(
        admin
          .from("digital_sources")
          .select(
            "id, ds_id, title, source_type, creator, institution, original_date, normalized_date, url, description, starred, created_at, updated_at",
          ),
      ).order("ds_seq", { ascending: true }).limit(60),
      admin
        .from("scan_transcriptions")
        .select("id, letter_id", { count: "exact" })
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(1000),
      admin
        .from("digital_files")
        .select("id, letter_id", { count: "exact" })
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(1000),
      admin
        .from("ai_suggestions")
        .select("letter_id, field_key, content, status, updated_at")
        .eq("field_key", "quotations")
        .eq("status", "accepted")
        .gte("updated_at", from)
        .lte("updated_at", to)
        .limit(60),
    ]);

  const letterRows = (letters ?? []) as any[];
  const sourceRows = (sources ?? []) as any[];
  const byId = new Map(letterRows.map((l) => [l.id, l.archive_id]));

  const quotes: { archive_id: string; text: string }[] = [];
  for (const s of (suggestions ?? []) as any[]) {
    const archiveId = byId.get(s.letter_id);
    if (!archiveId) continue;
    const content = s.content;
    const list = Array.isArray(content) ? content : typeof content === "string" ? [content] : [];
    for (const item of list.slice(0, 3)) {
      const text = typeof item === "string" ? item : String(item?.text ?? item?.quote ?? "");
      if (text.trim()) quotes.push({ archive_id: archiveId, text: text.trim().slice(0, 400) });
    }
  }

  const archiveIds = [
    ...letterRows.map((l) => l.archive_id as string),
    ...sourceRows.map((s) => s.ds_id as string),
  ].filter(Boolean);

  // Rich text + entities come from the research index that already exists.
  let indexRows: any[] = [];
  if (archiveIds.length) {
    const { data } = await admin
      .from("research_index")
      .select(
        "archive_id, kind, title, record_type, date_text, sort_date, author, recipient, origin, destination, tones, keywords, people, places, events, organizations, linked_refs, summary, body",
      )
      .in("archive_id", archiveIds.slice(0, 120));
    indexRows = (data ?? []) as any[];
  }

  // A single JPEG derivative from this week's material (never the TIFF master).
  let image: WeekMaterial["image"] = null;
  const letterIds = letterRows.map((l) => l.id);
  if (letterIds.length) {
    const { data: derivs } = await admin
      .from("file_derivatives")
      .select("letter_id, storage_path, kind, created_at")
      .eq("kind", "jpeg")
      .in("letter_id", letterIds.slice(0, 100))
      .order("created_at", { ascending: false })
      .limit(30);
    const preferred =
      (derivs ?? []).find((d: any) => letterRows.find((l) => l.id === d.letter_id && l.starred)) ??
      (derivs ?? []).find((d: any) =>
        letterRows.find((l) => l.id === d.letter_id && l.record_type === "photograph"),
      ) ??
      (derivs ?? [])[0];
    if (preferred) {
      const owner = letterRows.find((l) => l.id === preferred.letter_id);
      image = {
        bucket: "scans",
        path: preferred.storage_path,
        archive_id: owner?.archive_id ?? "",
        caption: owner?.title || owner?.archive_id || "",
      };
    }
  }

  return {
    letters: letterRows,
    sources: sourceRows,
    quotes,
    indexRows,
    counts: {
      records: letterRows.length,
      sources: sourceRows.length,
      transcriptions: (transcriptions ?? []).length,
      files: (files ?? []).length,
    },
    image,
    archiveIds,
  };
}

/** Prior recaps + collection-wide entity frequencies give the model continuity. */
async function gatherMemory(admin: any, weekStart: string) {
  const [{ data: prior }, { data: allIndex }] = await Promise.all([
    admin
      .from("weekly_recaps")
      .select("week_start, week_end, title, lede, body_md, related_ids")
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false })
      .limit(5),
    admin.from("research_index").select("archive_id, people, places, events, organizations, tones").limit(2000),
  ]);

  const tally = (key: string) => {
    const counts = new Map<string, number>();
    for (const row of (allIndex ?? []) as any[]) {
      for (const value of (row[key] ?? []) as string[]) {
        if (!value) continue;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([name, n]) => `${name} (${n})`);
  };

  return {
    prior: (prior ?? []) as any[],
    collection: {
      people: tally("people"),
      places: tally("places"),
      events: tally("events"),
      organizations: tally("organizations"),
      tones: tally("tones"),
      total: (allIndex ?? []).length,
    },
  };
}

// ---------------------------------------------------------------- generation

const SYSTEM = `You write the "Weekly Francis Files Recap" for a private family history archive (The Francis Files — the papers of Francis and Jacquelyn Harrington: prewar, wartime and postwar letters, photographs, documents and digital sources).

You are an engaging historical storyteller, not a database reporting engine. A family member who has never opened the database should read the recap in a few minutes and understand what was learned about Francis, Jacquelyn, their family and their world.

Hard rules:
- Use ONLY the supplied archive material and previous recaps. Never invent records, people, places, ships, dates or quotations.
- The archive is NOT being processed chronologically. Records handled in one week may span decades. Never imply the recap covers one week of Francis's life; it covers what the archive revealed this week.
- Cite records inline by their number (FH0042, DS0007) wherever a factual observation comes from a record. Never state an archival fact without a record number.
- Connect this week's material to earlier discoveries and previous recaps when the evidence genuinely supports it — say "again", "a third reference", "this adds to". Never manufacture a connection.
- Separate evidence from interpretation. Use hedged phrasing for developing patterns: "the letters are beginning to suggest", "a pattern may be emerging", "we are starting to see". Never diagnose anyone psychologically or overstate a conclusion.
- Historical context may be added briefly where it explains why something matters. Keep it to a sentence or two.
- Avoid statistics-first writing ("27 records were processed"). Prefer names, places, quotes and specifics.
- Roughly one readable page total. Plain markdown paragraphs and short bullets only; no tables, no headings other than the ones requested.`;

function materialText(m: WeekMaterial) {
  const indexById = new Map(m.indexRows.map((r) => [r.archive_id, r]));
  const blocks: string[] = [];
  for (const l of m.letters) {
    const idx = indexById.get(l.archive_id);
    blocks.push(
      [
        `RECORD ${l.archive_id}`,
        l.title ? `Title: ${l.title}` : "",
        l.record_type ? `Type: ${l.record_type}${l.subtype ? ` / ${l.subtype}` : ""}` : "",
        l.date_as_written || l.normalized_date ? `Date: ${l.date_as_written || l.normalized_date}` : "",
        l.period ? `Period: ${l.period}` : "",
        l.author ? `From: ${l.author}` : "",
        l.recipient ? `To: ${l.recipient}` : "",
        l.origin ? `Origin: ${l.origin}` : "",
        l.destination ? `Destination: ${l.destination}` : "",
        l.starred ? "Flagged as a Francis File Find" : "",
        (l.tones ?? []).length ? `Tones: ${(l.tones ?? []).join(", ")}` : "",
        idx?.people?.length ? `People: ${idx.people.join(", ")}` : "",
        idx?.places?.length ? `Places: ${idx.places.join(", ")}` : "",
        idx?.events?.length ? `Events: ${idx.events.join(", ")}` : "",
        idx?.organizations?.length ? `Organizations: ${idx.organizations.join(", ")}` : "",
        idx?.keywords?.length ? `Keywords: ${idx.keywords.join(", ")}` : "",
        idx?.linked_refs?.length ? `Linked records: ${idx.linked_refs.join(", ")}` : "",
        l.summary_short ? `Summary: ${l.summary_short}` : "",
        l.summary_long ? `Detail: ${String(l.summary_long).slice(0, 1200)}` : "",
        l.historical_notes ? `Historical notes: ${String(l.historical_notes).slice(0, 800)}` : "",
        l.research_notes ? `Research notes: ${String(l.research_notes).slice(0, 800)}` : "",
        idx?.body ? `TEXT:\n${String(idx.body).slice(0, 6000)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  for (const s of m.sources) {
    const idx = indexById.get(s.ds_id);
    blocks.push(
      [
        `DIGITAL SOURCE ${s.ds_id}`,
        s.title ? `Title: ${s.title}` : "",
        s.source_type ? `Type: ${s.source_type}` : "",
        s.creator ? `Creator: ${s.creator}` : "",
        s.institution ? `Institution: ${s.institution}` : "",
        s.original_date || s.normalized_date ? `Date: ${s.original_date || s.normalized_date}` : "",
        s.description ? `Description: ${String(s.description).slice(0, 1200)}` : "",
        idx?.people?.length ? `People: ${idx.people.join(", ")}` : "",
        idx?.places?.length ? `Places: ${idx.places.join(", ")}` : "",
        idx?.body ? `TEXT:\n${String(idx.body).slice(0, 3000)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return blocks.join("\n\n---\n\n").slice(0, 160000);
}

export type RecapDraft = {
  title: string;
  lede: string;
  body_md: string;
  related_ids: string[];
  image_caption: string | null;
};

async function writeRecap(
  material: WeekMaterial,
  memory: Awaited<ReturnType<typeof gatherMemory>>,
  weekStart: string,
  weekEnd: string,
): Promise<RecapDraft> {
  const priorText = memory.prior
    .map(
      (p) =>
        `PREVIOUS RECAP (${p.week_start} → ${p.week_end}) ${p.title}\n${String(p.lede ?? "")}\n${String(p.body_md ?? "").slice(0, 2500)}`,
    )
    .join("\n\n---\n\n");

  const prompt = `WEEK COVERED: ${formatRange(weekStart, weekEnd)} (records processed during this week, from any period of Francis's life)

WORK THIS WEEK: ${material.counts.records} FH records, ${material.counts.sources} digital sources, ${material.counts.files} files added, ${material.counts.transcriptions} page transcriptions.

THIS WEEK'S ARCHIVE MATERIAL
${materialText(material) || "(nothing was processed this week)"}

QUOTATIONS ACCEPTED THIS WEEK
${material.quotes.map((q) => `${q.archive_id}: "${q.text}"`).join("\n") || "(none)"}

COLLECTION SO FAR (frequency across the whole indexed archive, ${memory.collection.total} records)
People: ${memory.collection.people.join("; ") || "—"}
Places: ${memory.collection.places.join("; ") || "—"}
Events: ${memory.collection.events.join("; ") || "—"}
Organizations: ${memory.collection.organizations.join("; ") || "—"}
Tones: ${memory.collection.tones.join("; ") || "—"}

PREVIOUS WEEKLY RECAPS (for continuity — refer back when the evidence supports it)
${priorText || "(this is the first recap)"}

Write the recap as a single JSON object:
{
  "title": "a short, specific, inviting headline for the week (no dates)",
  "lede": "one sentence, max 220 characters, previewing the week for the recap list",
  "body_md": "markdown with exactly these four sections, in this order, each introduced by '## What We Uncovered', '## Threads Taking Shape', '## From the Files', '## Worth Exploring'. What We Uncovered = 2-4 story-first paragraphs. Threads Taking Shape = short bullets on recurring people, places, events, subjects or emotional patterns actually supported by the archive, including links back to earlier weeks. From the Files = 1-3 standout quotes, photographs, documents or discoveries, each attributed to its record number (quotes formatted as: > \\"quoted text\\" — FH0087). Worth Exploring = 2-4 sentences of forward-looking curiosity.",
  "related_ids": ["every record number actually cited, e.g. FH0087, DS0023"],
  "image_caption": "one short caption for this week's featured image, or null"
}

If nothing meaningful was processed this week, say so honestly and briefly instead of padding.`;

  const parsed = parseJson(await callModel(SYSTEM, prompt));
  const known = new Set(material.archiveIds);
  return {
    title: String(parsed.title ?? "").trim().slice(0, 160) || "Weekly Recap",
    lede: String(parsed.lede ?? "").trim().slice(0, 400),
    body_md: String(parsed.body_md ?? "").trim(),
    related_ids: (Array.isArray(parsed.related_ids) ? parsed.related_ids : [])
      .map((x: any) => String(x).trim().toUpperCase())
      .filter((x: string) => known.has(x))
      .slice(0, 40),
    image_caption: parsed.image_caption ? String(parsed.image_caption).slice(0, 240) : null,
  };
}

// ------------------------------------------------------------------- runner

export type RecapRunResult = {
  status: "ok" | "error";
  week_start?: string;
  week_end?: string;
  id?: string;
  error?: string;
};

/**
 * Generates (or regenerates) the recap for one week and stores it.
 * `mode: "scheduled"` covers the week that just ended; `"current"` covers the
 * week in progress. Existing rows are replaced in place — history is preserved
 * because every week is its own row.
 */
export async function runWeeklyRecap(
  mode: "scheduled" | "current" | "week",
  options: { weekStart?: string; publish?: boolean } = {},
): Promise<RecapRunResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  let weekStart: string;
  let weekEnd: string;
  if (mode === "week" && options.weekStart) {
    weekStart = options.weekStart;
    const end = new Date(`${weekStart}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    weekEnd = end.toISOString().slice(0, 10);
  } else {
    ({ weekStart, weekEnd } = weekBounds(new Date(), mode === "scheduled"));
  }

  const [material, memory] = await Promise.all([
    gatherWeek(admin, weekStart, weekEnd),
    gatherMemory(admin, weekStart),
  ]);
  const draft = await writeRecap(material, memory, weekStart, weekEnd);

  const { data: existing } = await admin
    .from("weekly_recaps")
    .select("id, status")
    .eq("week_start", weekStart)
    .maybeSingle();

  const row = {
    week_start: weekStart,
    week_end: weekEnd,
    title: draft.title,
    lede: draft.lede,
    body_md: draft.body_md,
    related_ids: draft.related_ids,
    image_bucket: material.image?.bucket ?? null,
    image_path: material.image?.path ?? null,
    image_archive_id: material.image?.archive_id ?? null,
    image_caption: draft.image_caption ?? material.image?.caption ?? null,
    stats: material.counts,
    model: MODEL,
    manually_edited: false,
    generated_at: new Date().toISOString(),
    status: options.publish === false ? "draft" : (existing?.status ?? "published"),
  };

  const { data, error } = existing
    ? await admin.from("weekly_recaps").update(row).eq("id", existing.id).select("id").single()
    : await admin.from("weekly_recaps").insert(row).select("id").single();
  if (error) throw new Error(`Saving the recap failed: ${error.message}`);

  return { status: "ok", week_start: weekStart, week_end: weekEnd, id: data?.id };
}
