import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Plus, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { postArchiveNote } from "@/lib/archive-notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ArchiveNote = {
  id: string;
  title: string | null;
  body: string;
  author_name: string | null;
  created_at: string;
};

async function fetchNotes(): Promise<ArchiveNote[]> {
  const { data, error } = await supabase
    .from("archive_notes")
    .select("id, title, body, author_name, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ArchiveNote[];
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ArchiveNotes() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery({ queryKey: ["archive-notes"], queryFn: fetchNotes });
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: async () =>
      postArchiveNote({
        title,
        body,
        authorId: user?.id,
        authorName: user?.email ?? null,
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      setComposeOpen(false);
      qc.invalidateQueries({ queryKey: ["archive-notes"] });
      toast.success("Note posted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("archive_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["archive-notes"] });
      toast.success("Note removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = notes[0];

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="field-label">Notes from the Archive</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setLedgerOpen(true)}>
            <BookOpen className="size-4" /> Note ledger{notes.length ? ` (${notes.length})` : ""}
          </Button>
          {isAdmin && (
            <Button size="sm" className="gap-2" onClick={() => setComposeOpen(true)}>
              <Plus className="size-4" /> New note
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {latest ? (
          <>
            <div className="mb-2 flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tone-amber-soft text-tone-amber">
                <NotebookPen className="size-4" />
              </div>
              <div className="min-w-0">
                {latest.title && <h3 className="font-display text-lg font-semibold">{latest.title}</h3>}
                <p className="text-xs text-muted-foreground">
                  {when(latest.created_at)}
                  {latest.author_name ? ` · ${latest.author_name}` : ""}
                </p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{latest.body}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No notes yet.{isAdmin ? " Post the first note for anyone browsing the archive." : ""}
          </p>
        )}
      </div>

      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Note ledger</DialogTitle>
            <DialogDescription>Every note left for archive visitors, newest first.</DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border">
            {notes.length === 0 && <p className="py-4 text-sm text-muted-foreground">No notes yet.</p>}
            {notes.map((n) => (
              <div key={n.id} className="flex items-start gap-3 py-4">
                <div className="min-w-0 flex-1">
                  {n.title && <h4 className="font-medium">{n.title}</h4>}
                  <p className="text-xs text-muted-foreground">
                    {when(n.created_at)}
                    {n.author_name ? ` · ${n.author_name}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete note"
                    onClick={() => remove.mutate(n.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New note from the archive</DialogTitle>
            <DialogDescription>Shown to anyone browsing the archive dashboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              rows={6}
              placeholder="Write your note…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !body.trim()}>
              {create.isPending ? "Posting…" : "Post note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
