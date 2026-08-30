import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Merge, Trash2, UserPlus } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: people = [] } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  function promptAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPendingName(trimmed);
    setConfirmOpen(true);
  }

  async function confirmAdd() {
    if (!pendingName) return;
    setSaving(true);
    const { error } = await supabase.from("people").insert({ name: pendingName });
    setSaving(false);
    if (error) {
      setConfirmOpen(false);
      return toast.error(error.message);
    }
    setName("");
    setPendingName("");
    setConfirmOpen(false);
    qc.invalidateQueries({ queryKey: ["people"] });
    toast.success(`Created person: ${pendingName}`);
  }

  function cancelAdd() {
    setConfirmOpen(false);
    setPendingName("");
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
                onKeyDown={(e) => e.key === "Enter" && promptAdd()}
              />
              <Button onClick={promptAdd}>Add person</Button>
            </div>
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <UserPlus className="h-6 w-6" />
              Confirm new person record
            </DialogTitle>
            <DialogDescription className="text-base">
              You are about to create a new person record in the database.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">New person name</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight break-words">
              {pendingName}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelAdd} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={confirmAdd} disabled={saving}>
              {saving ? "Creating…" : "Create person record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
