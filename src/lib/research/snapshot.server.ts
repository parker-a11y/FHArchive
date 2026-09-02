/**
 * Research Snapshot engine (server-only).
 *
 * Builds a complete, portable research dataset from the Francis Archive:
 * archive.json, CSV tables, per-record Markdown, a SQLite build script, a
 * machine-readable schema.json and a README — then rebuilds the research index
 * that Ask Francis retrieves evidence from.
 *
 * It is strictly read-only against archival data: nothing here ever writes to
 * letters, transcriptions, people, places or any other catalog table.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKET = "research-snapshots";

/** Every table captured in the snapshot. */
const TABLES = [
  "letters",
  "letter_people",
  "letter_places",
  "letter_keywords",
  "letter_organizations",
  "letter_events",
  "letter_relations",
  "letter_sources",
  "people",
  "person_aliases",
  "places",
  "keywords",
  "organizations",
  "events",
  "tone_options",
  "record_categories",
  "record_links",
  "historical_references",
  "historical_claims",
  "ai_suggestions",
  "archive_notes",
  "edit_history",
  "digital_sources",
  "ds_files",
  "ds_segments",
  "ds_people",
  "ds_places",
  "ds_keywords",
  "ds_organizations",
  "ds_events",
  "digital_files",
  "file_derivatives",
  "scan_transcriptions",
  "source_containers",
  "container_files",
] as const;

type Row = Record<string, any>;
type Dump = Record<string, Row[]>;

async function loadTable(admin: any, table: string): Promise<Row[]> {
  const rows: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// ---------------------------------------------------------------- CSV output

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Row[], columns?: string[]): string {
  const cols =
    columns ??
    Array.from(rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()));
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

// ------------------------------------------------------------- SQLite script

function sqlLiteral(value: unknown): string {
  if (value == null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function sqliteScript(dump: Dump): string {
  const parts: string[] = [
    "-- Francis Archive research snapshot — SQLite build script",
    "-- Build with:  sqlite3 archive.sqlite < archive.sqlite.sql",
    "PRAGMA journal_mode = MEMORY;",
    "BEGIN TRANSACTION;",
  ];
  for (const [table, rows] of Object.entries(dump)) {
    if (!rows.length) continue;
    const cols = Array.from(
      rows.reduce<Set<string>>((s, r) => {
        Object.keys(r).forEach((k) => s.add(k));
        return s;
      }, new Set<string>()),
    );
    parts.push(
      `DROP TABLE IF EXISTS "${table}";`,
      `CREATE TABLE "${table}" (${cols.map((c) => `"${c}" TEXT`).join(", ")});`,
    );
    for (const row of rows) {
      parts.push(
        `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols
          .map((c) => sqlLiteral(row[c]))
          .join(", ")});`,
      );
    }
  }
  parts.push("COMMIT;");
  return parts.join("\n");
}

// ------------------------------------------------------------------ helpers

function nameMap(rows: Row[], key: string) {
  return new Map(rows.map((r) => [r["id"] as string, (r[key] ?? "") as string]));
}

function groupNames(
  links: Row[],
  parentKey: string,
  targetKey: string,
  names: Map<string, string>,
) {
  const out = new Map<string, string[]>();
  for (const link of links) {
    const name = names.get(link[targetKey] as string);
    if (!name) continue;
    const list = out.get(link[parentKey] as string) ?? [];
    list.push(link["role"] ? `${name} (${link["role"]})` : name);
    out.set(link[parentKey] as string, list);
  }
  return out;
}

function plainList(list?: string[]) {
  return (list ?? []).map((v) => v.replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean);
}

// ------------------------------------------------------------ composed model

export type ComposedRecord = Record<string, any>;

function composeRecords(dump: Dump) {
  const people = nameMap(dump["people"] ?? [], "name");
  const places = new Map(
    (dump["places"] ?? []).map((p) => [p["id"] as string, (p["canonical_name"] ?? "") as string]),
  );
  const orgs = nameMap(dump["organizations"] ?? [], "name");
  const events = nameMap(dump["events"] ?? [], "name");
  const keywords = nameMap(dump["keywords"] ?? [], "name");

  const lPeople = groupNames(dump["letter_people"] ?? [], "letter_id", "person_id", people);
  const lPlaces = groupNames(dump["letter_places"] ?? [], "letter_id", "place_id", places);
  const lOrgs = groupNames(dump["letter_organizations"] ?? [], "letter_id", "organization_id", orgs);
  const lEvents = groupNames(dump["letter_events"] ?? [], "letter_id", "event_id", events);
  const lKeywords = groupNames(dump["letter_keywords"] ?? [], "letter_id", "keyword_id", keywords);

  const sPeople = groupNames(dump["ds_people"] ?? [], "source_id", "person_id", people);
  const sPlaces = groupNames(dump["ds_places"] ?? [], "source_id", "place_id", places);
  const sOrgs = groupNames(dump["ds_organizations"] ?? [], "source_id", "organization_id", orgs);
  const sEvents = groupNames(dump["ds_events"] ?? [], "source_id", "event_id", events);
  const sKeywords = groupNames(dump["ds_keywords"] ?? [], "source_id", "keyword_id", keywords);

  const letterById = new Map((dump["letters"] ?? []).map((l) => [l["id"] as string, l]));
  const sourceById = new Map((dump["digital_sources"] ?? []).map((s) => [s["id"] as string, s]));

  const refOf = (kind: string, id: string) =>
    kind === "source"
      ? ((sourceById.get(id)?.["ds_id"] ?? null) as string | null)
      : ((letterById.get(id)?.["archive_id"] ?? null) as string | null);

  /** Both link systems collapsed into one "linked records" view. */
  const linked = new Map<string, { ref: string; note: string | null; via: string }[]>();
  const addLink = (fromId: string, ref: string | null, note: string | null, via: string) => {
    if (!ref) return;
    const list = linked.get(fromId) ?? [];
    list.push({ ref, note, via });
    linked.set(fromId, list);
  };
  for (const rel of dump["letter_relations"] ?? []) {
    addLink(rel["letter_id"], refOf("record", rel["related_letter_id"]), rel["note"] ?? rel["relation_type"], "letter_relations");
    addLink(rel["related_letter_id"], refOf("record", rel["letter_id"]), rel["note"] ?? rel["relation_type"], "letter_relations");
  }
  for (const link of dump["record_links"] ?? []) {
    addLink(link["a_id"], refOf(link["b_kind"], link["b_id"]), link["note"] ?? null, "record_links");
    addLink(link["b_id"], refOf(link["a_kind"], link["a_id"]), link["note"] ?? null, "record_links");
  }
  for (const ls of dump["letter_sources"] ?? []) {
    addLink(ls["letter_id"], refOf("source", ls["source_id"]), ls["explanation"] ?? null, "letter_sources");
    addLink(ls["source_id"], refOf("record", ls["letter_id"]), ls["explanation"] ?? null, "letter_sources");
  }

  const filesByLetter = new Map<string, Row[]>();
  for (const f of dump["digital_files"] ?? []) {
    const list = filesByLetter.get(f["letter_id"]) ?? [];
    list.push(f);
    filesByLetter.set(f["letter_id"], list);
  }
  const derivativesByFile = new Map<string, Row[]>();
  for (const d of dump["file_derivatives"] ?? []) {
    const list = derivativesByFile.get(d["file_id"]) ?? [];
    list.push(d);
    derivativesByFile.set(d["file_id"], list);
  }
  const pagesByLetter = new Map<string, Row[]>();
  for (const t of dump["scan_transcriptions"] ?? []) {
    const list = pagesByLetter.get(t["letter_id"]) ?? [];
    list.push(t);
    pagesByLetter.set(t["letter_id"], list);
  }
  const refsByLetter = new Map<string, Row[]>();
  for (const r of dump["historical_references"] ?? []) {
    const list = refsByLetter.get(r["letter_id"]) ?? [];
    list.push(r);
    refsByLetter.set(r["letter_id"], list);
  }
  const suggestionsByLetter = new Map<string, Row[]>();
  for (const s of dump["ai_suggestions"] ?? []) {
    const list = suggestionsByLetter.get(s["letter_id"]) ?? [];
    list.push(s);
    suggestionsByLetter.set(s["letter_id"], list);
  }
  const containerById = new Map(
    (dump["source_containers"] ?? []).map((c) => [c["id"] as string, c]),
  );

  const records: ComposedRecord[] = (dump["letters"] ?? []).map((l) => {
    const files = (filesByLetter.get(l["id"]) ?? []).sort(
      (a, b) => (a["sort_order"] ?? 0) - (b["sort_order"] ?? 0),
    );
    const container = l["source_container_id"] ? containerById.get(l["source_container_id"]) : null;
    return {
      ...l,
      people: lPeople.get(l["id"]) ?? [],
      places: lPlaces.get(l["id"]) ?? [],
      organizations: lOrgs.get(l["id"]) ?? [],
      events: lEvents.get(l["id"]) ?? [],
      keywords: lKeywords.get(l["id"]) ?? [],
      linked_records: linked.get(l["id"]) ?? [],
      source_container: container
        ? { box_id: container["box_id"], title: container["title"] }
        : null,
      research_questions: (suggestionsByLetter.get(l["id"]) ?? [])
        .filter((s) => s["field_key"] === "questions" && s["content"])
        .flatMap((s) => String(s["content"]).split("\n").map((x) => x.trim()).filter(Boolean)),
      historical_references: (refsByLetter.get(l["id"]) ?? []).map((r) => ({
        reference: r["reference"],
        ref_type: r["ref_type"],
        description: r["description"],
        research_status: r["research_status"],
        notes: r["notes"],
        source_links: r["source_links"],
      })),
      pages: (pagesByLetter.get(l["id"]) ?? [])
        .sort((a, b) => (a["page_index"] ?? 0) - (b["page_index"] ?? 0))
        .map((p) => ({
          page_label: p["page_label"],
          page_index: p["page_index"],
          status: p["status"],
          ai_text: p["ai_text"],
          verified_text: p["verified_text"],
        })),
      files: files.map((f) => ({
        id: f["id"],
        label: f["label"],
        original_filename: f["original_filename"],
        master_path: f["master_path"],
        master_mime: f["master_mime"],
        master_size: f["master_size"],
        rotation: f["rotation"],
        notes: f["notes"],
        derivatives: (derivativesByFile.get(f["id"]) ?? []).map((d) => ({
          kind: d["kind"],
          status: d["status"],
          storage_path: d["storage_path"],
          mime_type: d["mime_type"],
          width: d["width"],
          height: d["height"],
        })),
      })),
    };
  });

  const sources: ComposedRecord[] = (dump["digital_sources"] ?? []).map((s) => ({
    ...s,
    people: sPeople.get(s["id"]) ?? [],
    places: sPlaces.get(s["id"]) ?? [],
    organizations: sOrgs.get(s["id"]) ?? [],
    events: sEvents.get(s["id"]) ?? [],
    keywords: sKeywords.get(s["id"]) ?? [],
    linked_records: linked.get(s["id"]) ?? [],
    segments: (dump["ds_segments"] ?? [])
      .filter((seg) => seg["source_id"] === s["id"])
      .sort((a, b) => (a["sort_order"] ?? 0) - (b["sort_order"] ?? 0)),
    files: (dump["ds_files"] ?? []).filter((f) => f["source_id"] === s["id"]),
  }));

  return { records, sources };
}

// ------------------------------------------------------------------ markdown

function recordMarkdown(r: ComposedRecord): string {
  const meta: [string, unknown][] = [
    ["FH number", r["archive_id"]],
    ["Title", r["title"]],
    ["Record type", r["record_type"]],
    ["Subtype", r["subtype"]],
    ["Date as written", r["date_as_written"]],
    ["Normalized date", r["normalized_date"]],
    ["Date precision", r["date_precision"]],
    ["Date certainty", r["date_certainty"]],
    ["Period", r["period"]],
    ["Author", r["author"]],
    ["Recipient", r["recipient"]],
    ["Primary person", r["primary_person"]],
    ["Mailing origin", r["origin"]],
    ["Mailing destination", r["destination"]],
    ["Forwarded", r["forwarded"] ? "yes" : ""],
    ["Forwarded to", r["forwarded_to"]],
    [
      "Postal service / postage",
      r["postal_service"] === "airmail"
        ? "airmail (counts as paid/stamped postage)"
        : r["postal_service"],
    ],
    ["Postal notes", r["postal_notes"]],
    ["Salutation", r["salutation_as_written"]],
    ["Addressee", r["addressee_normalized"]],
    ["Closing", r["closing_as_written"]],
    ["Signature", r["signature_as_written"]],
    ["Tones", (r["tones"] ?? []).join(", ")],
    ["People", (r["people"] ?? []).join(", ")],
    ["Places", (r["places"] ?? []).join(", ")],
    ["Organizations", (r["organizations"] ?? []).join(", ")],
    ["Events", (r["events"] ?? []).join(", ")],
    ["Keywords", (r["keywords"] ?? []).join(", ")],
    ["Linked records", (r["linked_records"] ?? []).map((l: any) => l.ref).join(", ")],
    ["Storage", [r["storage_type"], r["storage_container"], r["storage_folder"], r["storage_position"]].filter(Boolean).join(" / ")],
    ["Container", r["source_container"] ? `${r["source_container"].box_id} — ${r["source_container"].title}` : ""],
    ["Provenance", r["provenance"]],
    ["Physical condition", r["physical_condition"]],
    ["Transcription status", r["transcription_status"]],
    ["Scan status", r["scan_status"]],
    ["Review status", r["review_status"]],
    ["Publication status", r["publication_status"]],
    ["Starred (FFF)", r["starred"] ? "yes" : "no"],
    ["Scans", (r["files"] ?? []).length],
  ];

  const lines = [`# ${r["archive_id"]}${r["title"] ? ` — ${r["title"]}` : ""}`, ""];
  lines.push("| Field | Value |", "| --- | --- |");
  for (const [k, v] of meta) {
    if (v == null || v === "" || v === 0) continue;
    lines.push(`| ${k} | ${String(v).replace(/\n/g, " ").replace(/\|/g, "\\|")} |`);
  }

  const block = (title: string, text?: string | null) => {
    if (!text || !String(text).trim()) return;
    lines.push("", `## ${title}`, "", String(text).trim());
  };
  block("Summary", r["summary_short"]);
  block("Extended summary", r["summary_long"]);
  block("Transcription (verified)", r["transcription_verified"]);
  block("Transcription (AI)", r["transcription_raw_ai"]);
  block("OCR text", r["ocr_text"]);
  block("Archivist notes", r["notes"]);
  block("Historical notes", r["historical_notes"]);
  block("Research notes", r["research_notes"]);
  block("Citations", r["citations"]);
  block("Digitization notes", r["digitization_notes"]);
  block("Original order notes", r["original_order_notes"]);

  if ((r["research_questions"] ?? []).length) {
    lines.push("", "## Research questions", "");
    for (const q of r["research_questions"]) lines.push(`- ${q}`);
  }
  if ((r["historical_references"] ?? []).length) {
    lines.push("", "## Historical references", "");
    for (const h of r["historical_references"])
      lines.push(`- **${h.reference}** (${h.ref_type}) — ${h.description ?? ""}`);
  }
  if ((r["pages"] ?? []).length) {
    lines.push("", "## Page transcriptions", "");
    for (const p of r["pages"]) {
      lines.push(`### ${p.page_label ?? `Page ${(p.page_index ?? 0) + 1}`} (${p.status})`, "");
      lines.push((p.verified_text || p.ai_text || "").trim(), "");
    }
  }
  if ((r["files"] ?? []).length) {
    lines.push("", "## Files", "");
    for (const f of r["files"]) {
      lines.push(
        `- ${f.label ?? f.original_filename ?? f.id} — master: \`${f.master_path}\`` +
          (f.derivatives?.length
            ? ` — derivatives: ${f.derivatives.map((d: any) => `${d.kind}: \`${d.storage_path}\``).join(", ")}`
            : ""),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function sourceMarkdown(s: ComposedRecord): string {
  const lines = [`# ${s["ds_id"]} — ${s["title"]}`, ""];
  const meta: [string, unknown][] = [
    ["Source type", s["source_type"]],
    ["Creator", s["creator"]],
    ["Institution", s["institution"]],
    ["Original date", s["original_date"]],
    ["Normalized date", s["normalized_date"]],
    ["URL", s["url"]],
    ["People", (s["people"] ?? []).join(", ")],
    ["Places", (s["places"] ?? []).join(", ")],
    ["Organizations", (s["organizations"] ?? []).join(", ")],
    ["Events", (s["events"] ?? []).join(", ")],
    ["Keywords", (s["keywords"] ?? []).join(", ")],
    ["Linked records", (s["linked_records"] ?? []).map((l: any) => l.ref).join(", ")],
  ];
  lines.push("| Field | Value |", "| --- | --- |");
  for (const [k, v] of meta) {
    if (!v) continue;
    lines.push(`| ${k} | ${String(v).replace(/\n/g, " ").replace(/\|/g, "\\|")} |`);
  }
  for (const [title, text] of [
    ["Description", s["description"]],
    ["Transcript", s["transcript"]],
    ["Notes", s["notes"]],
    ["Citation", s["citation"]],
    ["Rights", s["rights_notes"]],
  ] as [string, string | null][]) {
    if (text?.trim()) lines.push("", `## ${title}`, "", text.trim());
  }
  return `${lines.join("\n")}\n`;
}

// ------------------------------------------------------------------- schema

function schemaJson(dump: Dump) {
  const describe = (rows: Row[]) => {
    const cols = new Map<string, Set<string>>();
    for (const row of rows.slice(0, 200)) {
      for (const [k, v] of Object.entries(row)) {
        const set = cols.get(k) ?? new Set<string>();
        set.add(v == null ? "null" : Array.isArray(v) ? "array" : typeof v);
        cols.set(k, set);
      }
    }
    return Array.from(cols.entries()).map(([name, types]) => ({
      name,
      types: Array.from(types),
    }));
  };
  return {
    generated_at: new Date().toISOString(),
    description:
      "Machine-readable description of the Francis Archive research export. 'records' are FH catalog records (letters, photographs, documents, artifacts). 'sources' are Digital Sources — external research material. Join tables connect records to people, places, events, organizations and keywords.",
    key_concepts: {
      archive_id: "The FH number, e.g. FH0042 — the stable public identifier of a record.",
      ds_id: "Digital Source identifier.",
      transcription_verified: "Human-verified transcription; authoritative text of a record.",
      transcription_raw_ai: "AI transcription before human verification.",
      tones: "Emotional tone/sentiment values assigned by an archivist (AI-suggested, human-confirmed).",
      linked_records: "Cross-references between FH records and/or Digital Sources.",
      starred: "Flagged as an FFF — Francis File Find (item of extreme interest).",
      historical_claims: "Research conclusions saved from Ask Francis. NOT catalog fact.",
    },
    tables: Object.fromEntries(
      Object.entries(dump).map(([name, rows]) => [
        name,
        { row_count: rows.length, columns: describe(rows) },
      ]),
    ),
  };
}

function readme(stamp: string, counts: Record<string, number>) {
  return `# Francis Archive — Research Snapshot

Generated: ${stamp}

This is a complete, read-only research export of the Francis Archive, produced for
AI research, analysis, portability and backup. Nothing here is authoritative over
the live archive: the archive itself remains the system of record.

## Contents

| File | Purpose |
| --- | --- |
| \`archive.json\` | Full structured export: every table, plus composed records with their people, places, events, transcriptions and files resolved. |
| \`archive.sqlite.sql\` | SQLite build script. Run \`sqlite3 archive.sqlite < archive.sqlite.sql\` to get a portable database. |
| \`schema.json\` | Machine-readable description of every table, column and key concept. |
| \`csv/*.csv\` | Flat tables — records, people, places, events, organizations, keywords, relationships and all join tables. |
| \`markdown/records/FH####.md\` | One Markdown file per FH record: metadata, transcription, notes. |
| \`markdown/sources/*.md\` | One Markdown file per Digital Source. |

## Counts

${Object.entries(counts)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

## Notes on interpretation

- \`archive_id\` (FH number) is the stable citation key. Always cite records by FH number.
- \`transcription_verified\` is human-checked; \`transcription_raw_ai\` is not.
- \`historical_claims\` are research conclusions, not archival facts.
- AI interpretation must never be presented as catalog data.
`;
}

// -------------------------------------------------------------------- runner

export type SnapshotResult = {
  snapshotId: string;
  status: "success" | "error";
  folder: string;
  records: number;
  sources: number;
  transcriptions: number;
  people: number;
  places: number;
  files: number;
  bytes: number;
  error?: string;
};

export async function runResearchSnapshot(
  trigger: "manual" | "scheduled" = "manual",
): Promise<SnapshotResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Keep the scheduled job's credential current so the nightly cron can call in.
  const cronSecret = process.env["LOVABLE_CRON_SECRET"];
  if (cronSecret) {
    await supabaseAdmin
      .from("job_config")
      .upsert(
        { key: "cron_secret", value: cronSecret, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, "-");
  const folder = `${day}/${time}Z`;

  const { data: runRow, error: runError } = await supabaseAdmin
    .from("research_snapshots")
    .insert({ status: "running", trigger, folder } as never)
    .select("id")
    .single();
  if (runError) throw new Error(`Could not start snapshot: ${runError.message}`);
  const snapshotId = (runRow as { id: string }).id;

  let bytes = 0;
  const written: string[] = [];
  const counts = { records: 0, sources: 0, transcriptions: 0, people: 0, places: 0, files: 0 };

  try {
    const dump: Dump = {};
    for (const table of TABLES) dump[table] = await loadTable(supabaseAdmin, table);

    const { records, sources } = composeRecords(dump);
    counts.records = records.length;
    counts.sources = sources.length;
    counts.transcriptions = (dump["scan_transcriptions"] ?? []).filter(
      (t) => (t["verified_text"] ?? t["ai_text"] ?? "").trim(),
    ).length;
    counts.people = (dump["people"] ?? []).length;
    counts.places = (dump["places"] ?? []).length;

    const upload = async (path: string, body: string, mime: string) => {
      const blob = new Blob([body], { type: mime });
      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(`${folder}/${path}`, blob, { contentType: mime, upsert: true });
      if (error) throw new Error(`Uploading ${path} failed: ${error.message}`);
      bytes += blob.size;
      written.push(path);
      counts.files += 1;
    };

    // 1. archive.json
    await upload(
      "archive.json",
      JSON.stringify(
        {
          archive: "The Francis Files",
          exported_at: now.toISOString(),
          snapshot_id: snapshotId,
          counts,
          records,
          sources,
          tables: dump,
        },
        null,
        2,
      ),
      "application/json",
    );

    // 2. schema.json + README.md
    await upload("schema.json", JSON.stringify(schemaJson(dump), null, 2), "application/json");
    await upload("README.md", readme(now.toISOString(), counts), "text/markdown");

    // 3. SQLite build script
    await upload("archive.sqlite.sql", sqliteScript(dump), "application/sql");

    // 4. CSV tables — the named research tables plus every raw table.
    const flatRecords = records.map((r) => ({
      ...Object.fromEntries(Object.entries(r).filter(([, v]) => !Array.isArray(v) || typeof v[0] !== "object")),
      people: (r["people"] ?? []).join("; "),
      places: (r["places"] ?? []).join("; "),
      events: (r["events"] ?? []).join("; "),
      organizations: (r["organizations"] ?? []).join("; "),
      keywords: (r["keywords"] ?? []).join("; "),
      tones: (r["tones"] ?? []).join("; "),
      linked_records: (r["linked_records"] ?? []).map((l: any) => l.ref).join("; "),
      pages: undefined,
      files: (r["files"] ?? []).length,
      historical_references: undefined,
      research_questions: (r["research_questions"] ?? []).join(" | "),
      source_container: r["source_container"]?.box_id ?? "",
    }));
    await upload("csv/records.csv", toCsv(flatRecords), "text/csv");

    const idToArchive = new Map(records.map((r) => [r["id"], r["archive_id"]]));
    const idToDs = new Map(sources.map((s) => [s["id"], s["ds_id"]]));
    const joinCsv = (
      rows: Row[],
      parentKey: string,
      targetKey: string,
      names: Map<string, string>,
      parentIds: Map<string, string>,
      label: string,
    ) =>
      rows.map((r) => ({
        record: parentIds.get(r[parentKey]) ?? r[parentKey],
        [label]: names.get(r[targetKey]) ?? r[targetKey],
        role: r["role"] ?? "",
        source: r["source"] ?? "",
      }));

    const peopleNames = nameMap(dump["people"] ?? [], "name");
    const placeNames = new Map(
      (dump["places"] ?? []).map((p) => [p["id"] as string, p["canonical_name"] as string]),
    );
    const eventNames = nameMap(dump["events"] ?? [], "name");
    const orgNames = nameMap(dump["organizations"] ?? [], "name");
    const kwNames = nameMap(dump["keywords"] ?? [], "name");

    await upload("csv/people.csv", toCsv(dump["people"] ?? []), "text/csv");
    await upload("csv/places.csv", toCsv(dump["places"] ?? []), "text/csv");
    await upload("csv/events.csv", toCsv(dump["events"] ?? []), "text/csv");
    await upload("csv/organizations.csv", toCsv(dump["organizations"] ?? []), "text/csv");
    await upload("csv/keywords.csv", toCsv(dump["keywords"] ?? []), "text/csv");
    await upload(
      "csv/record_people.csv",
      toCsv(joinCsv(dump["letter_people"] ?? [], "letter_id", "person_id", peopleNames, idToArchive, "person")),
      "text/csv",
    );
    await upload(
      "csv/record_places.csv",
      toCsv(joinCsv(dump["letter_places"] ?? [], "letter_id", "place_id", placeNames, idToArchive, "place")),
      "text/csv",
    );
    await upload(
      "csv/record_events.csv",
      toCsv(joinCsv(dump["letter_events"] ?? [], "letter_id", "event_id", eventNames, idToArchive, "event")),
      "text/csv",
    );
    await upload(
      "csv/record_organizations.csv",
      toCsv(joinCsv(dump["letter_organizations"] ?? [], "letter_id", "organization_id", orgNames, idToArchive, "organization")),
      "text/csv",
    );
    await upload(
      "csv/record_keywords.csv",
      toCsv(joinCsv(dump["letter_keywords"] ?? [], "letter_id", "keyword_id", kwNames, idToArchive, "keyword")),
      "text/csv",
    );
    await upload(
      "csv/linked_records.csv",
      toCsv(
        records
          .concat(sources)
          .flatMap((r) =>
            (r["linked_records"] ?? []).map((l: any) => ({
              from: r["archive_id"] ?? r["ds_id"],
              to: l.ref,
              via: l.via,
              note: l.note ?? "",
            })),
          ),
      ),
      "text/csv",
    );
    await upload(
      "csv/relationships.csv",
      toCsv(
        (dump["person_aliases"] ?? [])
          .map((a) => ({
            subject: peopleNames.get(a["person_id"]) ?? a["person_id"],
            relation: "alias",
            object: a["alias"],
          }))
          .concat(
            (dump["people"] ?? [])
              .filter((p) => p["relationship"])
              .map((p) => ({
                subject: p["name"],
                relation: "family_relationship",
                object: p["relationship"],
              })),
          ),
      ),
      "text/csv",
    );
    await upload("csv/digital_sources.csv", toCsv(dump["digital_sources"] ?? []), "text/csv");
    await upload("csv/digital_files.csv", toCsv(dump["digital_files"] ?? []), "text/csv");
    await upload("csv/file_derivatives.csv", toCsv(dump["file_derivatives"] ?? []), "text/csv");
    await upload("csv/scan_transcriptions.csv", toCsv(dump["scan_transcriptions"] ?? []), "text/csv");
    await upload("csv/historical_claims.csv", toCsv(dump["historical_claims"] ?? []), "text/csv");
    await upload("csv/archive_notes.csv", toCsv(dump["archive_notes"] ?? []), "text/csv");
    await upload(
      "csv/historical_references.csv",
      toCsv(
        (dump["historical_references"] ?? []).map((r) => ({
          record: idToArchive.get(r["letter_id"]) ?? r["letter_id"],
          ...r,
        })),
      ),
      "text/csv",
    );
    await upload("csv/source_containers.csv", toCsv(dump["source_containers"] ?? []), "text/csv");

    // 5. Markdown per record and per digital source
    for (const r of records) await upload(`markdown/records/${r["archive_id"]}.md`, recordMarkdown(r), "text/markdown");
    for (const s of sources) {
      const slug = String(s["ds_id"] ?? s["id"]).replace(/[^\w.-]+/g, "_");
      await upload(`markdown/sources/${slug}.md`, sourceMarkdown(s), "text/markdown");
    }
    void idToDs;

    // 6. Rebuild the research index used by Ask Francis
    await rebuildResearchIndex(supabaseAdmin, snapshotId, records, sources);

    await supabaseAdmin
      .from("research_snapshots")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        files: written as never,
        records_indexed: counts.records,
        sources_indexed: counts.sources,
        transcriptions_indexed: counts.transcriptions,
        people_count: counts.people,
        places_count: counts.places,
        bytes_written: bytes,
      } as never)
      .eq("id", snapshotId);

    return {
      snapshotId,
      status: "success",
      folder,
      records: counts.records,
      sources: counts.sources,
      transcriptions: counts.transcriptions,
      people: counts.people,
      places: counts.places,
      files: counts.files,
      bytes,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("research_snapshots")
      .update({ status: "error", finished_at: new Date().toISOString(), error: message } as never)
      .eq("id", snapshotId);
    return {
      snapshotId,
      status: "error",
      folder,
      records: counts.records,
      sources: counts.sources,
      transcriptions: counts.transcriptions,
      people: counts.people,
      places: counts.places,
      files: counts.files,
      bytes,
      error: message,
    };
  }
}

/** Rewrites the retrieval index from the composed snapshot data. */
async function rebuildResearchIndex(
  admin: any,
  snapshotId: string,
  records: ComposedRecord[],
  sources: ComposedRecord[],
) {
  const rows = [
    ...records.map((r) => {
      const pageText = (r["pages"] ?? [])
        .map((p: any) => (p.verified_text || p.ai_text || "").trim())
        .filter(Boolean)
        .join("\n\n");
      const body = [
        r["transcription_verified"],
        !r["transcription_verified"] ? r["transcription_raw_ai"] : "",
        !r["transcription_verified"] && !r["transcription_raw_ai"] ? pageText : "",
        r["ocr_text"],
        r["summary_long"],
        r["notes"],
        r["historical_notes"],
        r["research_notes"],
        r["physical_description"],
        r["provenance"],
        (r["people"] ?? []).join(", "),
        (r["places"] ?? []).join(", "),
        (r["events"] ?? []).join(", "),
        (r["organizations"] ?? []).join(", "),
        (r["keywords"] ?? []).join(", "),
        (r["tones"] ?? []).join(", "),
        (r["research_questions"] ?? []).join("\n"),
      ]
        .filter((x) => x && String(x).trim())
        .join("\n\n")
        .slice(0, 200000);
      return {
        kind: "record",
        ref_id: r["id"],
        archive_id: r["archive_id"],
        title: r["title"] ?? null,
        record_type: r["record_type"] ?? null,
        subtype: r["subtype"] ?? null,
        period: r["period"] ?? null,
        sort_date: r["sort_date"] ?? r["normalized_date"] ?? null,
        date_text: r["date_as_written"] ?? null,
        author: r["author"] ?? null,
        recipient: r["recipient"] ?? null,
        origin: r["origin"] ?? null,
        destination: r["destination"] ?? null,
        tones: r["tones"] ?? [],
        keywords: plainList(r["keywords"]),
        people: plainList(r["people"]),
        places: plainList(r["places"]),
        events: plainList(r["events"]),
        organizations: plainList(r["organizations"]),
        linked_refs: (r["linked_records"] ?? []).map((l: any) => l.ref),
        summary: r["summary_short"] ?? null,
        body,
        has_transcription: Boolean(
          (r["transcription_verified"] ?? "").trim() || (r["transcription_raw_ai"] ?? "").trim() || pageText,
        ),
        snapshot_id: snapshotId,
        updated_at: new Date().toISOString(),
      };
    }),
    ...sources.map((s) => ({
      kind: "source",
      ref_id: s["id"],
      archive_id: s["ds_id"],
      title: s["title"] ?? null,
      record_type: s["source_type"] ?? null,
      subtype: null,
      period: null,
      sort_date: s["normalized_date"] ?? null,
      date_text: s["original_date"] ?? null,
      author: s["creator"] ?? null,
      recipient: null,
      origin: s["institution"] ?? null,
      destination: null,
      tones: [],
      keywords: plainList(s["keywords"]),
      people: plainList(s["people"]),
      places: plainList(s["places"]),
      events: plainList(s["events"]),
      organizations: plainList(s["organizations"]),
      linked_refs: (s["linked_records"] ?? []).map((l: any) => l.ref),
      summary: s["description"] ?? null,
      body: [s["transcript"], s["description"], s["notes"], s["citation"]]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 200000),
      has_transcription: Boolean((s["transcript"] ?? "").trim()),
      snapshot_id: snapshotId,
      updated_at: new Date().toISOString(),
    })),
  ];

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await admin
      .from("research_index")
      .upsert(rows.slice(i, i + 100) as never, { onConflict: "kind,ref_id" });
    if (error) throw new Error(`Indexing failed: ${error.message}`);
  }
  // Drop index rows for records that no longer exist.
  await admin.from("research_index").delete().neq("snapshot_id", snapshotId);
}
