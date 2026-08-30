import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { addPersonAlias } from "@/lib/person-match";

type Alias = { id: string; alias: string };

/** Alternate spellings that automatically match to this person. */
export function AliasManager({ personId }: { personId: string }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const key = ["person_aliases", personId];

  const { data: aliases = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase.from("person_aliases" as any) as any)
        .select("id,alias")
        .eq("person_id", personId)
        .order("alias");
      if (error) throw new Error(error.message);
      return (data ?? []) as Alias[];
    },
  });

  async function add() {
    const alias = value.trim();
    if (!alias) return;
    try {
      await addPersonAlias(personId, alias);
      setValue("");
      qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the alternate spelling");
    }
  }

  async function remove(id: string) {
    const { error } = await (supabase.from("person_aliases" as any) as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div>
      <label className="field-label">Alternate spellings (auto-matched)</label>
      <div className="flex flex-wrap gap-2 py-1">
        {aliases.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-muted/50 px-2 py-1 text-xs"
          >
            {a.alias}
            <button type="button" onClick={() => remove(a.id)} aria-label={`Remove ${a.alias}`}>
              <X className="size-3 text-muted-foreground" />
            </button>
          </span>
        ))}
        {aliases.length === 0 && (
          <span className="text-xs text-muted-foreground">None yet.</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          placeholder="e.g. FA Harrington"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
