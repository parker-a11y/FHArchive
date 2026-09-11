import { supabase } from "@/integrations/supabase/client";
import { logEdits } from "@/lib/queries";

/**
 * Applies an accepted AI suggestion to archival data.
 *
 * Summary fields update the record; entity fields create/link AI-sourced
 * entities. Everything else is kept as a reviewed research note only.
 */

function splitList(content: string): string[] {
  return content
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
    .filter((s) => s.length > 1 && s.toLowerCase() !== "none");
}

async function findOrCreate(
  table: "people" | "places" | "keywords" | "organizations" | "events",
  nameColumn: string,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<string | null> {
  const { data: found } = await (supabase.from(table) as any)
    .select("id")
    .ilike(nameColumn, name)
    .limit(1)
    .maybeSingle();
  if (found?.id) return found.id as string;
  const { data, error } = await (supabase.from(table) as any)
    .insert({ [nameColumn]: name, ...extra })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data?.id as string) ?? null;
}

async function link(table: string, row: Record<string, unknown>) {
  const { error } = await (supabase.from(table as "letter_people") as any)
    .insert(row as never)
    .select("id");
  // Duplicate links are fine — the unique constraint just means it already exists.
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

export type ApplyResult = { applied: boolean; note: string };

/**
 * Resolves a proposed person name to an archive person. Supplied by the UI so
 * near-duplicate names can be confirmed against existing records; returning
 * null skips linking that name.
 */
export type PersonResolver = (name: string) => Promise<{ id: string; name: string } | null>;

export type EntityKindKey = "person" | "place" | "organization" | "event";

/** Returns true when a brand-new entity of this name may be created/linked. */
export type EntityGate = (kind: EntityKindKey, name: string) => boolean;

const FIELD_KIND: Record<string, EntityKindKey> = {
  people: "person",
  places: "place",
  ships: "organization",
  units: "organization",
  organizations: "organization",
  events: "event",
};

/** Entity names a suggestion would create/link, for pre-accept confirmation. */
export function suggestionEntities(
  fieldKey: string,
  content: string,
): { kind: EntityKindKey; name: string }[] {
  const kind = FIELD_KIND[fieldKey];
  if (!kind) return [];
  return splitList(content.trim()).map((name) => ({ kind, name }));
}

const LINK_TABLES: Record<
  string,
  { link: string; fk: string; table: "people" | "places" | "keywords" | "organizations" | "events"; column: string }
> = {
  people: { link: "letter_people", fk: "person_id", table: "people", column: "name" },
  places: { link: "letter_places", fk: "place_id", table: "places", column: "canonical_name" },
  keywords: { link: "letter_keywords", fk: "keyword_id", table: "keywords", column: "name" },
  units: { link: "letter_organizations", fk: "organization_id", table: "organizations", column: "name" },
  ships: { link: "letter_organizations", fk: "organization_id", table: "organizations", column: "name" },
  organizations: {
    link: "letter_organizations",
    fk: "organization_id",
    table: "organizations",
    column: "name",
  },
  events: { link: "letter_events", fk: "event_id", table: "events", column: "name" },
};

const compare = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Names the previously accepted answer contained that the new reading no longer
 * supports — offered to the archivist before anything is unlinked.
 */
export function suggestionRemovals(
  fieldKey: string,
  previousContent: string,
  newContent: string,
): string[] {
  if (!LINK_TABLES[fieldKey]) return [];
  const keep = new Set(splitList(newContent).map(compare));
  const seen = new Set<string>();
  return splitList(previousContent).filter((name) => {
    const key = compare(name);
    if (!key || keep.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Removes AI-created links for names dropped by a re-read. Links the archivist
 * made by hand (source other than "ai") are never touched.
 */
export async function unlinkSuggestionEntities(
  letterId: string,
  fieldKey: string,
  names: string[],
): Promise<number> {
  const map = LINK_TABLES[fieldKey];
  if (!map || !names.length) return 0;
  let removed = 0;
  for (const name of names) {
    const { data: found } = await (supabase.from(map.table) as any)
      .select("id")
      .ilike(map.column, name)
      .limit(1)
      .maybeSingle();
    if (!found?.id) continue;
    const { data: deleted } = await (supabase.from(map.link as "letter_people") as any)
      .delete()
      .eq("letter_id", letterId)
      .eq(map.fk, found.id)
      .eq("source", "ai")
      .select("id");
    removed += (deleted ?? []).length;
  }
  return removed;
}

/** Field keys that write into the same link table as `fieldKey`. */
export function siblingFieldKeys(fieldKey: string): string[] {
  const map = LINK_TABLES[fieldKey];
  if (!map) return [];
  return Object.keys(LINK_TABLES).filter((k) => LINK_TABLES[k].link === map.link);
}

/**
 * AI-created links already on the record that the newly accepted answer no
 * longer mentions. Looks at the record's real links instead of relying on the
 * stored "before" wording, so corrections made before this feature existed are
 * caught too. Hand-made links (source other than "ai") are ignored, as are
 * names still supported by another accepted answer of the same kind.
 */
export async function unsupportedAiLinks(
  letterId: string,
  fieldKey: string,
  newContent: string,
): Promise<string[]> {
  const map = LINK_TABLES[fieldKey];
  if (!map) return [];

  const keep = new Set(splitList(newContent).map(compare));

  // Other accepted answers that feed the same link table still count as support.
  const siblings = siblingFieldKeys(fieldKey);
  const { data: others } = await supabase
    .from("ai_suggestions")
    .select("field_key,content,status")
    .eq("letter_id", letterId)
    .in("field_key", siblings);
  for (const row of others ?? []) {
    if (row.status !== "accepted" || row.field_key === fieldKey) continue;
    for (const n of splitList(row.content ?? "")) keep.add(compare(n));
  }

  const { data: links } = await (supabase.from(map.link as "letter_people") as any)
    .select(`${map.fk}, ${map.table}(${map.column})${map.link === "letter_people" ? ", role" : ""}`)
    .eq("letter_id", letterId)
    .eq("source", "ai");

  const rows = ((links ?? []) as Record<string, any>[]).filter(
    // Author / recipient links come from the record's own fields, not from a
    // suggestion, so they are never candidates for removal.
    (r) => map.link !== "letter_people" || r.role === "mentioned",
  );

  // A person may be linked under their canonical name while the suggestion used
  // a nickname ("Fran"), so aliases count as support too.
  const aliasByEntity = new Map<string, string[]>();
  if (map.table === "people" && rows.length) {
    const ids = rows.map((r) => r[map.fk]).filter(Boolean);
    const { data: aliases } = await (supabase.from("person_aliases" as any) as any)
      .select("person_id,alias")
      .in("person_id", ids);
    for (const a of (aliases ?? []) as { person_id: string; alias: string }[]) {
      const list = aliasByEntity.get(a.person_id) ?? [];
      list.push(a.alias);
      aliasByEntity.set(a.person_id, list);
    }
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name: string = row?.[map.table]?.[map.column] ?? "";
    const key = compare(name);
    if (!name || !key || seen.has(key)) continue;
    const forms = [key, ...(aliasByEntity.get(row[map.fk]) ?? []).map(compare)].filter(Boolean);
    if (forms.some((f) => keep.has(f))) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export async function applySuggestion(
  letterId: string,
  fieldKey: string,
  content: string,
  letterBefore: Record<string, unknown>,
  resolvePerson?: PersonResolver,
  allowEntity?: EntityGate,
): Promise<ApplyResult> {
  const text = content.trim();
  if (!text) return { applied: false, note: "Nothing to apply" };

  const LETTER_TEXT_FIELDS = [
    "summary_short",
    "summary_long",
    "salutation_as_written",
    "addressee_normalized",
    "closing_as_written",
    "signature_as_written",
  ];

  if (LETTER_TEXT_FIELDS.includes(fieldKey)) {
    const patch = { [fieldKey]: text } as Record<string, string>;
    const { error } = await supabase
      .from("letters")
      .update(patch as never)
      .eq("id", letterId);

    if (error) throw new Error(error.message);
    await logEdits(letterId, letterBefore, { [fieldKey]: text });
    return { applied: true, note: "Saved to the record" };
  }

  let names = splitList(text);
  const kind = FIELD_KIND[fieldKey];
  if (kind && allowEntity) names = names.filter((n) => allowEntity(kind, n));
  if (!names.length) return { applied: false, note: "Kept as a reviewed note" };

  switch (fieldKey) {
    case "keywords": {
      for (const name of names) {
        const id = await findOrCreate("keywords", "name", name);
        if (id)
          await link("letter_keywords", {
            letter_id: letterId,
            keyword_id: id,
            source: "ai",
            confirmed: true,
          });
      }
      return { applied: true, note: `${names.length} keyword(s) linked` };
    }
    case "people": {
      let linked = 0;
      let skipped = 0;
      for (const name of names) {
        const person = resolvePerson
          ? await resolvePerson(name)
          : { id: (await findOrCreate("people", "name", name)) ?? "", name };
        if (!person?.id) {
          skipped++;
          continue;
        }
        await link("letter_people", {
          letter_id: letterId,
          person_id: person.id,
          role: "mentioned",
          source: "ai",
        });
        linked++;
      }
      return {
        applied: linked > 0,
        note: `${linked} person/people linked${skipped ? `, ${skipped} skipped` : ""}`,
      };
    }
    case "places": {
      for (const name of names) {
        const id = await findOrCreate("places", "canonical_name", name);
        if (id)
          await link("letter_places", {
            letter_id: letterId,
            place_id: id,
            role: "mentioned",
            source: "ai",
          });
      }
      return { applied: true, note: `${names.length} place(s) linked` };
    }
    case "ships":
    case "units":
    case "organizations": {
      const orgType =
        fieldKey === "ships" ? "ship" : fieldKey === "units" ? "military_unit" : "other";
      for (const name of names) {
        const id = await findOrCreate("organizations", "name", name, { org_type: orgType });
        if (id)
          await link("letter_organizations", {
            letter_id: letterId,
            organization_id: id,
            role: "mentioned",
            source: "ai",
          });
      }
      return { applied: true, note: `${names.length} organization(s) linked` };
    }
    case "events": {
      for (const name of names) {
        const id = await findOrCreate("events", "name", name, { event_type: "other" });
        if (id)
          await link("letter_events", { letter_id: letterId, event_id: id, source: "ai" });
      }
      return { applied: true, note: `${names.length} event(s) linked` };
    }
    default:
      return { applied: false, note: "Kept as a reviewed note" };
  }
}
