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

export async function applySuggestion(
  letterId: string,
  fieldKey: string,
  content: string,
  letterBefore: Record<string, unknown>,
): Promise<ApplyResult> {
  const text = content.trim();
  if (!text) return { applied: false, note: "Nothing to apply" };

  if (fieldKey === "summary_short" || fieldKey === "summary_long") {
    const patch = fieldKey === "summary_short" ? { summary_short: text } : { summary_long: text };
    const { error } = await supabase.from("letters").update(patch).eq("id", letterId);

    if (error) throw new Error(error.message);
    await logEdits(letterId, letterBefore, { [fieldKey]: text });
    return { applied: true, note: "Summary saved to the record" };
  }

  const names = splitList(text);
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
      for (const name of names) {
        const id = await findOrCreate("people", "name", name);
        if (id)
          await link("letter_people", {
            letter_id: letterId,
            person_id: id,
            role: "mentioned",
            source: "ai",
          });
      }
      return { applied: true, note: `${names.length} person/people linked` };
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
