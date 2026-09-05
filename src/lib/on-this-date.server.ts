/**
 * "On This Date" historical context (server-only).
 *
 * Reads existing archival structures for a single calendar date, then asks the
 * model to write a short, factually grounded narrative of the wider world on
 * that day. The only table it writes is `date_contexts`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const MODEL =
  process.env["ON_THIS_DATE_MODEL"] || process.env["RESEARCH_MODEL"] || "google/gemini-3.7-flash";

export function prettyDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function callModel(system: string, prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The historical context service is not configured on the server");
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
    throw new Error(`Historical context failed (${res.status}): ${body.slice(0, 300)}`);
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
    if (start === -1 || end <= start) throw new Error("The historical narrative could not be read");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/** Everything the archive already knows about this exact day. */
async function gatherArchiveContext(admin: any, date: string) {
  const [{ data: letters }, { data: sources }, { data: events }] = await Promise.all([
    admin
      .from("letters")
      .select(
        "id, archive_id, title, record_type, subtype, author, recipient, origin, destination, summary_short, summary_long, historical_notes, tones, date_as_written, date_from_postmark",
      )
      .eq("normalized_date", date)
      .limit(40),
    admin
      .from("digital_sources")
      .select("id, ds_id, title, source_type, creator, institution, description")
      .eq("normalized_date", date)
      .limit(20),
    admin
      .from("events")
      .select("id, name, event_type, start_date, end_date, description")
      .lte("start_date", date)
      .or(`end_date.is.null,end_date.gte.${date}`)
      .limit(20),
  ]);

  const ids = (letters ?? []).map((l: any) => l.id);
  let people: string[] = [];
  let places: string[] = [];
  let orgs: string[] = [];
  if (ids.length) {
    const [p, pl, o] = await Promise.all([
      admin.from("letter_people").select("people(name)").in("letter_id", ids).limit(200),
      admin.from("letter_places").select("places(canonical_name)").in("letter_id", ids).limit(200),
      admin.from("letter_organizations").select("organizations(name)").in("letter_id", ids).limit(200),
    ]);
    people = [...new Set((p.data ?? []).map((r: any) => r.people?.name).filter(Boolean))] as string[];
    places = [...new Set((pl.data ?? []).map((r: any) => r.places?.canonical_name).filter(Boolean))] as string[];
    orgs = [...new Set((o.data ?? []).map((r: any) => r.organizations?.name).filter(Boolean))] as string[];
  }

  return { letters: letters ?? [], sources: sources ?? [], events: events ?? [], people, places, orgs };
}

const SYSTEM = `You are a museum historian writing short contextual essays for a private
family archive of World War II era letters, photographs and documents (the Francis Harrington
Archive). Francis Harrington served as a U.S. Navy officer in the Pacific, at times aboard the
destroyer escort USS Doyle C. Barnes; his wife Jacquelyn ("Jaq") wrote from Worcester, Massachusetts.

Write factually grounded history only. Never invent an event, a date, a name or a statistic. If you
cannot establish a specific event for the exact date, describe accurately the larger campaign,
situation or trend underway at that time instead. Prefer authoritative institutions (National
Archives, Naval History and Heritage Command, Library of Congress, National WWII Museum, U.S. Army
Center of Military History, Smithsonian, presidential libraries, established universities).

Style: 2-4 short flowing paragraphs of narrative prose, like a compact museum wall panel or a short
newspaper retrospective. Never a bulleted list of facts, never trivia padding.

Editorial priority for wartime dates: the Pacific theater, U.S. Navy operations, destroyer escort,
convoy and anti-submarine work, major battles and campaigns, then the European theater, the American
home front, and important political or diplomatic developments. Include a notable non-war event
(sport, culture, science, politics, Massachusetts / Worcester / Boston news) only when it genuinely
adds texture.

Relating history to the archive: you may connect outside events to the archive's people, places,
ships and events when the connection is real. Clearly distinguish a documented connection from
reasonable historical context, and never assert a relationship that is only a coincidence of timing.

Return strict JSON:
{"narrative_md": "markdown paragraphs", "sources": [{"title": "...", "publisher": "...", "url": "https://..."}]}
Give 2-5 sources. Only cite URLs you are confident exist at reputable institutions; if unsure of an
exact URL, cite the institution's main site with a descriptive title.`;

export async function generateDateNarrative(admin: any, date: string) {
  const ctx = await gatherArchiveContext(admin, date);
  const lines: string[] = [];
  lines.push(`Date: ${prettyDate(date)} (${date})`);
  if (ctx.letters.length) {
    lines.push("\nArchive records dated this day:");
    for (const l of ctx.letters) {
      lines.push(
        `- ${l.archive_id} ${l.record_type}${l.subtype ? `/${l.subtype}` : ""}: ${l.title ?? "untitled"}` +
          `${l.author ? `; from ${l.author}` : ""}${l.recipient ? ` to ${l.recipient}` : ""}` +
          `${l.origin ? `; written at ${l.origin}` : ""}${l.destination ? `; sent to ${l.destination}` : ""}` +
          `${l.summary_short ? `; summary: ${l.summary_short}` : ""}` +
          `${l.historical_notes ? `; notes: ${String(l.historical_notes).slice(0, 400)}` : ""}`,
      );
    }
  } else {
    lines.push("\nThe archive holds no record dated exactly this day.");
  }
  if (ctx.people.length) lines.push(`People linked to those records: ${ctx.people.join(", ")}`);
  if (ctx.places.length) lines.push(`Places linked: ${ctx.places.join(", ")}`);
  if (ctx.orgs.length) lines.push(`Organizations / ships linked: ${ctx.orgs.join(", ")}`);
  if (ctx.events.length)
    lines.push(
      `Archive events spanning this date: ${ctx.events
        .map((e: any) => `${e.name} (${e.start_date}${e.end_date ? `–${e.end_date}` : ""})`)
        .join("; ")}`,
    );
  if (ctx.sources.length)
    lines.push(
      `Digital sources dated this day: ${ctx.sources
        .map((s: any) => `${s.ds_id} ${s.title}${s.institution ? ` (${s.institution})` : ""}`)
        .join("; ")}`,
    );
  lines.push(
    "\nWrite 'The World on This Date' for this exact calendar date, following the editorial rules.",
  );

  const raw = await callModel(SYSTEM, lines.join("\n"));
  const parsed = parseJson(raw);
  const narrative = String(parsed.narrative_md ?? "").trim();
  if (!narrative) throw new Error("The historical narrative came back empty — try again.");
  const sources = Array.isArray(parsed.sources)
    ? parsed.sources
        .filter((s: any) => s && (s.title || s.url))
        .slice(0, 6)
        .map((s: any) => ({
          title: String(s.title ?? "Source").slice(0, 200),
          publisher: s.publisher ? String(s.publisher).slice(0, 160) : null,
          url: s.url ? String(s.url).slice(0, 500) : null,
        }))
    : [];
  return { narrative, sources, model: MODEL };
}

/** Existing row, or generate + store one. Never regenerates an existing row. */
export async function ensureDateContext(admin: any, date: string) {
  const { data: existing } = await admin
    .from("date_contexts")
    .select("*")
    .eq("on_date", date)
    .maybeSingle();

  if (existing) {
    await admin
      .from("date_contexts")
      .update({
        view_count: (existing.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing;
  }

  const { narrative, sources, model } = await generateDateNarrative(admin, date);
  const { data, error } = await admin
    .from("date_contexts")
    .upsert(
      {
        on_date: date,
        narrative_md: narrative,
        sources,
        model,
        view_count: 1,
        last_viewed_at: new Date().toISOString(),
        generated_at: new Date().toISOString(),
      },
      { onConflict: "on_date" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Explicit regeneration — replaces the narrative even if it was hand-edited. */
export async function regenerateDateContext(admin: any, date: string) {
  const { narrative, sources, model } = await generateDateNarrative(admin, date);
  const { data: existing } = await admin
    .from("date_contexts")
    .select("id, regenerated_count, view_count")
    .eq("on_date", date)
    .maybeSingle();
  const payload = {
    on_date: date,
    narrative_md: narrative,
    sources,
    model,
    manually_edited: false,
    regenerated_count: (existing?.regenerated_count ?? 0) + 1,
    generated_at: new Date().toISOString(),
    view_count: existing?.view_count ?? 0,
  };
  const { data, error } = await admin
    .from("date_contexts")
    .upsert(payload, { onConflict: "on_date" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
