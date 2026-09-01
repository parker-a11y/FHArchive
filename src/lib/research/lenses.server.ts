/**
 * Research lenses (server-only).
 *
 * Each lens is a different way of reading the SAME research index that powers
 * Ask Francis: a chronology, a people network, a geography, a theme profile,
 * and a contradictions pass. Timeline / People / Map / Themes are computed
 * deterministically from archive data — no model involved. Contradictions is
 * the one lens that needs judgement, so it asks the research model over
 * compact metadata only.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type LensKey = "timeline" | "people" | "map" | "themes" | "contradictions";

export type TimelineItem = {
  archive_id: string;
  title: string | null;
  date: string | null;
  record_type: string | null;
  author: string | null;
  origin: string | null;
};

export type LensResult =
  | {
      lens: "timeline";
      total: number;
      undated: number;
      groups: { year: string; count: number; items: TimelineItem[] }[];
    }
  | {
      lens: "people";
      nodes: { name: string; count: number }[];
      edges: { a: string; b: string; count: number }[];
      pairsFrom: number;
    }
  | {
      lens: "map";
      places: { name: string; count: number; ids: string[] }[];
      routes: { from: string; to: string; count: number }[];
    }
  | {
      lens: "themes";
      keywords: { name: string; count: number }[];
      tones: { name: string; count: number }[];
      types: { name: string; count: number }[];
      total: number;
    }
  | {
      lens: "contradictions";
      items: { issue: string; detail: string; records: string[]; confidence: string }[];
      checked: number;
      model: string;
    };

const SELECT =
  "kind, archive_id, title, record_type, sort_date, date_text, author, recipient, origin, destination, tones, keywords, people, places, summary";

async function loadIndex(admin: any, limit = 2000) {
  const { data, error } = await admin
    .from("research_index")
    .select(SELECT)
    .order("sort_date", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

const clean = (v: unknown) => String(v ?? "").trim();

function tally(values: string[]) {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const name = clean(raw);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

export async function buildLens(admin: any, lens: LensKey): Promise<LensResult> {
  const rows = await loadIndex(admin);

  if (lens === "timeline") {
    const dated = rows.filter((r) => r.sort_date);
    const byYear = new Map<string, TimelineItem[]>();
    for (const r of dated) {
      const year = String(r.sort_date).slice(0, 4);
      const item: TimelineItem = {
        archive_id: r.archive_id,
        title: r.title ?? null,
        date: r.date_text || r.sort_date || null,
        record_type: r.record_type ?? null,
        author: r.author ?? null,
        origin: r.origin ?? null,
      };
      byYear.set(year, [...(byYear.get(year) ?? []), item]);
    }
    const groups = Array.from(byYear, ([year, items]) => ({
      year,
      count: items.length,
      items: items.slice(0, 60),
    })).sort((a, b) => a.year.localeCompare(b.year));
    return { lens, total: rows.length, undated: rows.length - dated.length, groups };
  }

  if (lens === "people") {
    const perRecord = rows.map((r) => {
      const names = new Set<string>();
      for (const n of [...(r.people ?? []), r.author, r.recipient]) {
        const v = clean(n);
        if (v) names.add(v);
      }
      return Array.from(names);
    });
    const nodes = tally(perRecord.flat()).slice(0, 40);
    const known = new Set(nodes.map((n) => n.name));
    const pairs = new Map<string, number>();
    for (const names of perRecord) {
      const list = names.filter((n) => known.has(n)).sort();
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const key = `${list[i]}||${list[j]}`;
          pairs.set(key, (pairs.get(key) ?? 0) + 1);
        }
    }
    const edges = Array.from(pairs, ([key, count]) => {
      const [a, b] = key.split("||");
      return { a: a!, b: b!, count };
    })
      .sort((x, y) => y.count - x.count)
      .slice(0, 60);
    return { lens, nodes, edges, pairsFrom: rows.length };
  }

  if (lens === "map") {
    const placeIds = new Map<string, Set<string>>();
    const routes = new Map<string, number>();
    for (const r of rows) {
      const names = new Set<string>();
      for (const p of [...(r.places ?? []), r.origin, r.destination]) {
        const v = clean(p);
        if (v) names.add(v);
      }
      for (const name of names) {
        if (!placeIds.has(name)) placeIds.set(name, new Set());
        placeIds.get(name)!.add(r.archive_id);
      }
      const from = clean(r.origin);
      const to = clean(r.destination);
      if (from && to && from !== to) {
        const key = `${from}||${to}`;
        routes.set(key, (routes.get(key) ?? 0) + 1);
      }
    }
    const places = Array.from(placeIds, ([name, ids]) => ({
      name,
      count: ids.size,
      ids: Array.from(ids).slice(0, 12),
    }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 60);
    const routeList = Array.from(routes, ([key, count]) => {
      const [from, to] = key.split("||");
      return { from: from!, to: to!, count };
    })
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);
    return { lens, places, routes: routeList };
  }

  if (lens === "themes") {
    return {
      lens,
      keywords: tally(rows.flatMap((r) => r.keywords ?? [])).slice(0, 50),
      tones: tally(rows.flatMap((r) => r.tones ?? [])).slice(0, 30),
      types: tally(rows.map((r) => r.record_type)).slice(0, 20),
      total: rows.length,
    };
  }

  // ---- contradictions: model pass over compact metadata + summaries ----
  const compact = rows
    .slice(0, 220)
    .map((r) =>
      [
        `${r.archive_id}`,
        r.date_text || r.sort_date ? `date: ${r.date_text || r.sort_date}` : "",
        r.author ? `from: ${r.author}` : "",
        r.recipient ? `to: ${r.recipient}` : "",
        r.origin ? `origin: ${r.origin}` : "",
        r.destination ? `destination: ${r.destination}` : "",
        (r.places ?? []).length ? `places: ${(r.places ?? []).slice(0, 6).join(", ")}` : "",
        (r.people ?? []).length ? `people: ${(r.people ?? []).slice(0, 8).join(", ")}` : "",
        r.summary ? `summary: ${String(r.summary).slice(0, 320)}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n")
    .slice(0, 120000);

  const { findContradictions } = await import("./contradictions.server");
  const found = await findContradictions(compact);
  const known = new Set(rows.map((r) => String(r.archive_id)));
  return {
    lens: "contradictions",
    items: found.items
      .map((i) => ({ ...i, records: i.records.filter((id) => known.has(id)) }))
      .filter((i) => i.records.length > 0)
      .slice(0, 25),
    checked: Math.min(rows.length, 220),
    model: found.model,
  };
}
