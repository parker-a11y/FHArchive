import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/places/")({
  head: () => ({
    meta: [
      { title: "Places — Harrington Letter Archive" },
      {
        name: "description",
        content:
          "Reusable place records with coordinates, ready for mapping Francis Harrington's movements.",
      },
      { property: "og:title", content: "Places — Harrington Letter Archive" },
      {
        property: "og:description",
        content: "Geographic records tied to the family letter collection.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Places />
    </AppShell>
  ),
});

function Places() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: places = [] } = useQuery({
    queryKey: ["places"],
    queryFn: async () => {
      const { data, error } = await supabase.from("places").select("*").order("canonical_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("places").insert({ canonical_name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["places"] });
  }

  return (
    <>
      <PageHeader title="Places" description={`${places.length} place records`} />
      <div className="max-w-3xl p-4 sm:p-8">
        <div className="mb-6 flex gap-2">
          <Input
            placeholder="New place, e.g. Fort Benning, Georgia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add}>Add place</Button>
        </div>
        <div className="divide-y divide-border rounded border border-border bg-card">
          {places.map((p) => (
            <Link
              key={p.id}
              to="/places/$placeId"
              params={{ placeId: p.id }}
              className="flex items-baseline gap-4 px-4 py-2.5 text-sm hover:bg-muted/60"
            >
              <span className="font-medium">{p.canonical_name}</span>
              <span className="text-muted-foreground">{p.country}</span>
            </Link>
          ))}
          {places.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">No places yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
