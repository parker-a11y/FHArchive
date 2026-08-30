import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { postArchiveNote } from "@/lib/archive-notes";
import { cn } from "@/lib/utils";
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

type Table = "letters" | "digital_sources";

export function StarToggle({
  table,
  id,
  starred,
  label,
  size = "icon",
  showLabel = false,
  className,
}: {
  table: Table;
  id: string;
  starred: boolean;
  /** Human-readable identifier, e.g. "FH0007 — Bell Bottom Trousers". */
  label: string;
  size?: "icon" | "sm";
  showLabel?: boolean;
  className?: string;
}) {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["letters"] });
    qc.invalidateQueries({ queryKey: ["letter"] });
    qc.invalidateQueries({ queryKey: ["digital-sources"] });
    qc.invalidateQueries({ queryKey: ["digital-source"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from(table).update({ starred: next }).eq("id", id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      invalidate();
      if (next) {
        toast.success("Marked of extreme interest");
        if (isAdmin) {
          setNoteTitle("Of extreme interest");
          setNoteBody(`An archive item of interest has been added: ${label}.`);
          setNoteOpen(true);
        }
      } else {
        toast.success("Star removed");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const post = useMutation({
    mutationFn: async () =>
      postArchiveNote({
        title: noteTitle,
        body: noteBody,
        authorId: user?.id,
        authorName: user?.email ?? null,
      }),
    onSuccess: () => {
      setNoteOpen(false);
      qc.invalidateQueries({ queryKey: ["archive-notes"] });
      toast.success("Note posted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={showLabel ? "sm" : "icon"}
        aria-pressed={starred}
        aria-label={starred ? "Remove of extreme interest" : "Mark of extreme interest"}
        title={starred ? "Of extreme interest" : "Mark of extreme interest"}
        className={cn(showLabel && "gap-2", className)}
        disabled={toggle.isPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle.mutate(!starred);
        }}
      >
        <Star
          className={cn(
            size === "sm" ? "size-3.5" : "size-4",
            starred ? "fill-tone-amber text-tone-amber" : "text-muted-foreground",
          )}
        />
        {showLabel && <span>{starred ? "Of extreme interest" : "Mark of extreme interest"}</span>}
      </Button>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Post a note from the archive?</DialogTitle>
            <DialogDescription>
              This item is now flagged of extreme interest. Add or edit the note shown to anyone
              browsing the archive, or skip it — the star is already saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Title (optional)"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <Textarea rows={5} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Skip
            </Button>
            <Button onClick={() => post.mutate()} disabled={post.isPending || !noteBody.trim()}>
              {post.isPending ? "Posting…" : "Post note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
