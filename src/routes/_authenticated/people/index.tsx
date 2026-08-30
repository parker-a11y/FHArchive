import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Merge, Trash2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersonMatcher } from "@/components/MatchPersonDialog";
import { DuplicatesPanel } from "@/components/people/DuplicatesPanel";
import { DeletePersonButton } from "@/components/people/DeletePersonButton";
import { MergePersonButton } from "@/components/people/MergePersonButton";

export const Route = createFileRoute("/_authenticated/people/")({
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
  const { isGuestViewer } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { resolvePerson, dialog: personDialog } = usePersonMatcher();
  const { data: people = [] } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  /**
   * Search existing people first: an exact/alias hit or a close match opens the
   * match dialog (merge into the existing person or confirm a new record),
   * so near-duplicates never silently become a second person.
   */
  async function promptAdd() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const person = await resolvePerson(trimmed);
      if (!person) return;
      setName("");
      await qc.invalidateQueries({ queryKey: ["people"] });
      toast.success(
        person.name.toLowerCase() === trimmed.toLowerCase()
          ? `Created person: ${person.name}`
          : `Matched to existing person: ${person.name}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the person");
    } finally {
      setSaving(false);
    }
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
            {!isGuestViewer && (
              <div className="mb-6 flex gap-2">
                <Input
                  placeholder="New person name…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && promptAdd()}
                />
                <Button onClick={promptAdd}>Add person</Button>
              </div>
            )}
            <div className="divide-y divide-border rounded border border-border bg-card">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-2 pr-2 hover:bg-muted/60">
                  <Link
                    to="/people/$personId"
                    params={{ personId: p.id }}
                    className="flex flex-1 items-baseline gap-4 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.relationship}</span>
                  </Link>
                  <MergePersonButton personId={p.id} name={p.name}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label={`Merge ${p.name} with other people`}
                      title="Merge duplicates"
                    >
                      <Merge className="h-4 w-4" />
                    </Button>
                  </MergePersonButton>
                  <DeletePersonButton personId={p.id} name={p.name}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DeletePersonButton>
                </div>
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
      {personDialog}
    </>

  );
}
