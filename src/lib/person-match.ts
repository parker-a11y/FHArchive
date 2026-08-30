import { supabase } from "@/integrations/supabase/client";

export type PersonMatch = {
  id: string;
  name: string;
  matched_on: string;
  score: number;
};

/** Normalized form used for "same spelling" comparisons. */
export function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Similar existing people, ranked best-first. */
export async function findPersonMatches(name: string, limit = 5): Promise<PersonMatch[]> {
  const { data, error } = await (supabase.rpc as any)("find_person_matches", {
    _name: name,
    _limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonMatch[];
}

export async function addPersonAlias(personId: string, alias: string) {
  const { error } = await (supabase.from("person_aliases" as any) as any).insert({
    person_id: personId,
    alias: alias.trim(),
  });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

export async function createPerson(name: string): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("people")
    .insert({ name: name.trim() })
    .select("id,name")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; name: string };
}

export type PersonResolution =
  | { kind: "exact"; person: { id: string; name: string } }
  | { kind: "ambiguous"; candidates: PersonMatch[] }
  | { kind: "new" };

/** Score at or above which we ask the user instead of silently creating a new person. */
export const ASK_THRESHOLD = 0.42;

export async function lookupPerson(name: string): Promise<PersonResolution> {
  const matches = await findPersonMatches(name);
  const target = normalizeName(name);
  const exact = matches.find((m) => normalizeName(m.matched_on) === target);
  if (exact) return { kind: "exact", person: { id: exact.id, name: exact.name } };
  const close = matches.filter((m) => m.score >= ASK_THRESHOLD);
  if (close.length) return { kind: "ambiguous", candidates: close };
  return { kind: "new" };
}

export async function mergePeople(targetId: string, sourceIds: string[]) {
  const { error } = await (supabase.rpc as any)("merge_people", {
    _target_id: targetId,
    _source_ids: sourceIds,
  });
  if (error) throw new Error(error.message);
}
