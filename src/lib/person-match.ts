import { supabase } from "@/integrations/supabase/client";
import { resolvePersonMatches, type PersonMatch, type PersonResolution } from "./person-resolution";
export { normalizeName, ASK_THRESHOLD, type PersonMatch, type PersonResolution } from "./person-resolution";

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

export async function lookupPerson(name: string): Promise<PersonResolution> {
  const matches = await findPersonMatches(name);
  return resolvePersonMatches(name, matches);
}

export async function mergePeople(targetId: string, sourceIds: string[]) {
  const { error } = await (supabase.rpc as any)("merge_people", {
    _target_id: targetId,
    _source_ids: sourceIds,
  });
  if (error) throw new Error(error.message);
}
