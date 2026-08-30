import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DuplicatesPanel } from "@/components/people/DuplicatesPanel";

export const Route = createFileRoute("/people/")({
  head: () => ({
    meta: [
      { title: "People — The Francis Files" },
      {
        name: "description",
        content:
          "Reusable person records for correspondents and people mentioned in The Francis Files letters.",
      },
      { property: "og:title", content: "People — The Francis Files" },
      {
        property: "og:description",
        content: "Correspondents and mentioned individuals across the collection.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <People />
    </AppShell>
  ),
});

function People() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: people = [] } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("people").insert({ name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["people"] });
  }

  return (
    <>
      <PageHeader title="People" description={`${people.length} person records`} />
      <div className="max-w-3xl p-4 sm:p-8">
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All people</TabsTrigger>
            <TabsTrigger value="dupes">Duplicates</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <div className="mb-6 flex gap-2">
              <Input
                placeholder="New person name…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
              <Button onClick={add}>Add person</Button>
            </div>
            <div className="divide-y divide-border rounded border border-border bg-card">
              {people.map((p) => (
                <Link
                  key={p.id}
                  to="/people/$personId"
                  params={{ personId: p.id }}
                  className="flex items-baseline gap-4 px-4 py-2.5 text-sm hover:bg-muted/60"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{p.relationship}</span>
                </Link>
              ))}
              {people.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">No people yet.</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="dupes">
            <DuplicatesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
