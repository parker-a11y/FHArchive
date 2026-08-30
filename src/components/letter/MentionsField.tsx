import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PersonMultiSelect, type PersonRef } from "@/components/PersonMultiSelect";

/**
 * People named in a record, stored as letter_people links with role
 * "mentioned". Saves immediately; never touches author/recipient links.
 */
export function MentionsField({ letterId }: { letterId: string }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["mentions", letterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letter_people")
        .select("id, person_id, people(name)")
        .eq("letter_id", letterId)
        .eq("role", "mentioned");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.person_id as string,
        name: ((r.people as { name?: string } | null)?.name ?? "Unknown") as string,
      })) as PersonRef[];
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["mentions", letterId] });
    qc.invalidateQueries({ queryKey: ["links", letterId] });
  }

  async function add(person: PersonRef) {
    const { data: auth } = await supabase.auth.getUser();
    const ownerId = auth.user?.id;
    if (!ownerId) throw new Error("Not signed in");
    const { error } = await supabase.from("letter_people").insert({
      owner_id: ownerId,
      letter_id: letterId,
      person_id: person.id,
      role: "mentioned",
      source: "manual",
    });
    if (error) throw error;
    await refresh();
  }

  async function remove(person: PersonRef) {
    const { error } = await supabase
      .from("letter_people")
      .delete()
      .eq("letter_id", letterId)
      .eq("person_id", person.id)
      .eq("role", "mentioned");
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  }

  return <PersonMultiSelect value={rows} onAdd={add} onRemove={remove} />;
}
