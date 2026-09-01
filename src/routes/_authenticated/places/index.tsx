import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Merge, Trash2 } from "lucide-react";
import { DeletePlaceButton } from "@/components/places/DeletePlaceButton";
import { MergePlaceButton } from "@/components/places/MergePlaceButton";

export const Route = createFileRoute("/_authenticated/places/")({
  head: () => ({
    meta: [
      { title: "Places — The Francis Files" },
      {
        name: "description",
        content:
          "Reusable place records with coordinates, ready for mapping Francis Harrington's movements.",
      },
      { property: "og:title", content: "Places — The Francis Files" },
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
  const { isGuestViewer } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: places = [] } = useQuery({
    queryKey: ["places"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("places")
        .select("id, canonical_name, city, region, country")
        .order("canonical_name");
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
        {!isGuestViewer && (
          <div className="mb-6 flex gap-2">
            <Input
              placeholder="New place, e.g. Fort Benning, Georgia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add}>Add place</Button>
          </div>
        )}
        <div className="divide-y divide-border rounded border border-border bg-card">
          {places.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-4 py-1.5 hover:bg-muted/60">
              <Link
                to="/places/$placeId"
                params={{ placeId: p.id }}
                className="flex flex-1 items-baseline gap-4 py-1 text-sm"
              >
                <span className="font-medium">{p.canonical_name}</span>
                <span className="text-muted-foreground">{p.country}</span>
              </Link>
              <MergePlaceButton placeId={p.id} name={p.canonical_name}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label={`Merge ${p.canonical_name}`}
                  title="Merge with other places"
                >
                  <Merge className="h-4 w-4" />
                </Button>
              </MergePlaceButton>
              <DeletePlaceButton placeId={p.id} name={p.canonical_name}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${p.canonical_name}`}
                  title="Delete place"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DeletePlaceButton>
            </div>
          ))}
          {places.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">No places yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
