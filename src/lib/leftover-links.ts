import { supabase } from "@/integrations/supabase/client";

/**
 * Archive-wide sweep for names the AI once linked to a record but which no
 * accepted AI answer supports any more (for example a "Cary" left behind after
 * the transcription was corrected to "Gary").
 *
 * Only links created by the AI (`source = 'ai'`) are ever considered, so
 * anything the archivist linked by hand is invisible to this tool. Records with
 * no accepted answer of that kind are skipped — there is nothing to judge them
 * against.
 */

export type LinkKind = "person" | "place" | "organization" | "event" | "keyword";

type Spec = {
  link: string;
  fk: string;
  table: string;
  column: string;
  fields: string[];
  label: string;
};

const SPECS: Record<LinkKind, Spec> = {
  person: {
    link: "letter_people",
    fk: "person_id",
    table: "people",
    column: "name",
    fields: ["people"],
    label: "Person",
  },
  place: {
    link: "letter_places",
    fk: "place_id",
    table: "places",
    column: "canonical_name",
    fields: ["places"],
    label: "Place",
  },
  organization: {
    link: "letter_organizations",
    fk: "organization_id",
    table: "organizations",
    column: "name",
    fields: ["organizations", "units", "ships"],
    label: "Organization",
  },
  event: {
    link: "letter_events",
    fk: "event_id",
    table: "events",
    column: "name",
    fields: ["events"],
    label: "Event",
  },
  keyword: {
    link: "letter_keywords",
    fk: "keyword_id",
    table: "keywords",
    column: "name",
    fields: ["keywords"],
    label: "Keyword",
  },
};

export const KIND_LABEL = Object.fromEntries(
  (Object.keys(SPECS) as LinkKind[]).map((k) => [k, SPECS[k].label]),
) as Record<LinkKind, string>;

export type LeftoverLink = {
  id: string;
  letterId: string;
  archiveId: string;
  kind: LinkKind;
  name: string;
  entityId: string;
};

const compare = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

function splitList(content: string): string[] {
  return content
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
    .filter((s) => s.length > 1 && s.toLowerCase() !== "none");
}

/** Reads every row of a table in pages, so nothing is silently truncated. */
async function readAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error((error as { message?: string }).message ?? "Query failed");
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export async function findLeftoverAiLinks(): Promise<LeftoverLink[]> {
  const allFields = Object.values(SPECS).flatMap((s) => s.fields);

  const [letters, suggestions] = await Promise.all([
    readAll<{ id: string; archive_id: string }>((from, to) =>
      supabase.from("letters").select("id,archive_id").range(from, to),
    ),
    readAll<{ letter_id: string; field_key: string; content: string | null; status: string }>(
      (from, to) =>
        supabase
          .from("ai_suggestions")
          .select("letter_id,field_key,content,status")
          .eq("status", "accepted")
          .in("field_key", allFields)
          .range(from, to),
    ),
  ]);

  const archiveIds = new Map(letters.map((l) => [l.id, l.archive_id]));

  // letterId -> kind -> supported names (and whether any answer exists at all)
  const supported = new Map<string, Map<LinkKind, Set<string>>>();
  const kindOfField = new Map<string, LinkKind>();
  for (const kind of Object.keys(SPECS) as LinkKind[])
    for (const f of SPECS[kind].fields) kindOfField.set(f, kind);

  for (const s of suggestions) {
    const kind = kindOfField.get(s.field_key);
    if (!kind) continue;
    let byKind = supported.get(s.letter_id);
    if (!byKind) supported.set(s.letter_id, (byKind = new Map()));
    let set = byKind.get(kind);
    if (!set) byKind.set(kind, (set = new Set()));
    for (const n of splitList(s.content ?? "")) set.add(compare(n));
  }

  // Nicknames: a person can be linked under their canonical name while the
  // accepted answer used an alias ("Fran"), which still counts as support.
  const aliasesByPerson = new Map<string, string[]>();
  for (const a of await readAll<{ person_id: string; alias: string }>((from, to) =>
    (supabase.from("person_aliases" as any) as any).select("person_id,alias").range(from, to),
  )) {
    const list = aliasesByPerson.get(a.person_id) ?? [];
    list.push(a.alias);
    aliasesByPerson.set(a.person_id, list);
  }

  const out: LeftoverLink[] = [];
  for (const kind of Object.keys(SPECS) as LinkKind[]) {
    const spec = SPECS[kind];
    const rows = await readAll<Record<string, any>>((from, to) =>
      (supabase.from(spec.link as "letter_people") as any)
        .select(
          `id, letter_id, ${spec.fk}, ${spec.table}(${spec.column})${
            kind === "person" ? ", role" : ""
          }`,
        )
        .eq("source", "ai")
        .range(from, to),
    );
    for (const row of rows) {
      // Author / recipient links come from the record's own fields.
      if (kind === "person" && row.role !== "mentioned") continue;
      const set = supported.get(row.letter_id)?.get(kind);
      if (!set) continue; // no accepted answer of this kind — nothing to judge against
      const name: string = row?.[spec.table]?.[spec.column] ?? "";
      const key = compare(name);
      if (!name || !key) continue;
      const forms = [
        key,
        ...(kind === "person" ? aliasesByPerson.get(row[spec.fk]) ?? [] : []).map(compare),
      ].filter(Boolean);
      if (forms.some((f) => set.has(f))) continue;
      out.push({
        id: row.id as string,
        letterId: row.letter_id as string,
        archiveId: archiveIds.get(row.letter_id) ?? "",
        kind,
        name,
        entityId: row[spec.fk] as string,
      });
    }
  }

  return out.sort(
    (a, b) => a.archiveId.localeCompare(b.archiveId) || a.name.localeCompare(b.name),
  );
}

/** Removes only the confirmed links; entity records themselves are kept. */
export async function removeLeftoverLinks(items: LeftoverLink[]): Promise<number> {
  let removed = 0;
  for (const kind of Object.keys(SPECS) as LinkKind[]) {
    const ids = items.filter((i) => i.kind === kind).map((i) => i.id);
    if (!ids.length) continue;
    const { data, error } = await (supabase.from(SPECS[kind].link as "letter_people") as any)
      .delete()
      .in("id", ids)
      .eq("source", "ai")
      .select("id");
    if (error) throw new Error(error.message);
    removed += (data ?? []).length;
  }
  return removed;
}
