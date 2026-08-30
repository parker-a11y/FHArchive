import { supabase } from "@/integrations/supabase/client";

export type PersonRole = "author" | "recipient" | "mentioned";

export type LetterPersonLink = {
  id: string;
  person_id: string;
  name: string;
  role: PersonRole;
};

/** Fetch the single person link for a given role on a record. */
export async function fetchLetterPersonByRole(
  letterId: string,
  role: PersonRole,
): Promise<LetterPersonLink | null> {
  const { data, error } = await supabase
    .from("letter_people")
    .select("id, person_id, role, people(name)")
    .eq("letter_id", letterId)
    .eq("role", role)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    person_id: data.person_id as string,
    role: data.role as PersonRole,
    name: ((data.people as { name?: string } | null)?.name ?? "Unknown") as string,
  };
}

/** Replace any existing role link with a new one, or delete it when personId is null. */
export async function setLetterPersonRole(
  letterId: string,
  role: PersonRole,
  personId: string | null,
  ownerId: string,
) {
  // Delete existing link(s) for this role.
  const { error: delError } = await supabase
    .from("letter_people")
    .delete()
    .eq("letter_id", letterId)
    .eq("role", role);
  if (delError) throw delError;

  if (!personId) return;

  const { error: insError } = await supabase.from("letter_people").insert({
    owner_id: ownerId,
    letter_id: letterId,
    person_id: personId,
    role,
    source: "manual",
  });
  if (insError) throw insError;
}

/** Bulk-insert author/recipient links for a newly created record. */
export async function linkLetterPeople(
  letterId: string,
  links: { personId: string; role: PersonRole }[],
  ownerId: string,
) {
  if (!links.length) return;
  const { error } = await supabase.from("letter_people").insert(
    links.map((l) => ({
      owner_id: ownerId,
      letter_id: letterId,
      person_id: l.personId,
      role: l.role,
      source: "manual",
    })),
  );
  if (error) throw error;
}
