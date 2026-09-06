/**
 * Compact "make a note out of this" panel used by the right-click menu.
 * Creates a draft note (never publishes) and optionally asks the AI to write
 * the first draft using the sentence the term was selected from.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createNote, findSimilarNotes, noteTitle, updateNote, type FfnNote } from "@/lib/ffn";
import { draftFrancisFileNote } from "@/lib/ffn.functions";

export type QuickNoteSeed = { term: string; context: string };

export function QuickNoteDialog({
  seed,
  onOpenChange,
}: {
  seed: QuickNoteSeed | null;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const draft = useServerFn(draftFrancisFileNote);
  const [term, setTerm] = useState("");
  const [similar, setSimilar] = useState<FfnNote[]>([]);
  const [busy, setBusy] = useState<"" | "save" | "ai">("");

  useEffect(() => {
    if (!seed) return;
    setTerm(seed.term);
    setSimilar([]);
    findSimilarNotes(seed.term)
      .then(setSimilar)
      .catch(() => {});
  }, [seed]);

  async function create(withAi: boolean) {
    const clean = term.trim();
    if (!clean) return;
    setBusy(withAi ? "ai" : "save");
    try {
      const note = await createNote({ term: clean, title: clean });
      if (withAi) {
        const result = await draft({ data: { term: clean, context: seed?.context } });
        await updateNote(note.id, {
          expanded_name: result.expanded_name ?? null,
          category: result.category ?? "other",
          short_definition: result.short_definition ?? null,
          background: result.background ?? null,
          archive_context: result.archive_context ?? null,
          sources: result.sources ?? null,
        });
      }
      qc.invalidateQueries({ queryKey: ["ffn-notes"] });
      onOpenChange(false);
      if (withAi) {
        navigate({ to: "/admin/notes/$noteId", params: { noteId: note.id } });
      } else {
        toast.success(`Draft note created for “${clean}”`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the note");
    } finally {
      setBusy("");
    }
  }

  return (
    <Dialog open={!!seed} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Francis File Note</DialogTitle>
          <DialogDescription>
            Saved as a draft — nothing appears in the archive until you publish it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="quick-note-term">Term</Label>
          <Input
            id="quick-note-term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoFocus
          />
        </div>

        {seed?.context && (
          <div className="space-y-1.5">
            <Label>Where you selected it</Label>
            <p className="max-h-32 overflow-y-auto rounded border bg-muted/40 p-2 text-sm text-muted-foreground italic">
              “{seed.context}”
            </p>
          </div>
        )}

        {similar.length > 0 && (
          <div className="rounded border border-archive-gold/50 bg-muted/40 p-3 text-sm">
            <p className="font-medium">There may already be a note for this</p>
            <ul className="mt-1 space-y-1">
              {similar.map((s) => (
                <li key={s.id}>
                  <button
                    className="text-primary hover:underline"
                    onClick={() => {
                      onOpenChange(false);
                      navigate({ to: "/admin/notes/$noteId", params: { noteId: s.id } });
                    }}
                  >
                    Open “{noteTitle(s)}”
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={!!busy} onClick={() => create(false)}>
            {busy === "save" ? "Saving…" : "Save as draft"}
          </Button>
          <Button disabled={!!busy} onClick={() => create(true)}>
            <Sparkles className="mr-1.5 size-4" />
            {busy === "ai" ? "Writing…" : "Draft with AI and open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
