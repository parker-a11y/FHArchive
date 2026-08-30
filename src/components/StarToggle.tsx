import { useEffect, useState } from "react";
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

/**
 * Prefilled "note from the archive" prompt shown after an item is starred.
 * The star itself is already saved — posting the note is optional.
 */
export function StarNoteDialog({
  open,
  onOpenChange,
  label,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  label: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("Of extreme interest");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("Of extreme interest");
      setBody(`An archive item of interest has been added: ${label}.`);
    }
  }, [open, label]);

  const post = useMutation({
    mutationFn: async () =>
      postArchiveNote({ title, body, authorId: user?.id, authorName: user?.email ?? null }),
    onSuccess: () => {
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["archive-notes"] });
      toast.success("Note posted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Post a note from the archive?</DialogTitle>
          <DialogDescription>
            This item is flagged of extreme interest. Add or edit the note shown to anyone browsing
            the archive, or skip it — the star is already saved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={() => post.mutate()} disabled={post.isPending || !body.trim()}>
            {post.isPending ? "Posting…" : "Post note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const { isAdmin, isGuestViewer } = useAuth();
  const qc = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);

  const invalidate = () => {
    for (const key of [
      "letters",
      "letters-page",
      "letter",
      "sources",
      "source",
      "dashboard-stats",
      "dashboard-recent",
    ]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
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
        if (isAdmin) setNoteOpen(true);
      } else {
        toast.success("Star removed");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isGuestViewer) {
    // Guests can't update records (RLS) — show the flag as a read-only marker.
    if (!starred) return null;
    return (
      <span
        className={cn("inline-flex items-center gap-2", className)}
        title="Of extreme interest"
        aria-label="Of extreme interest"
      >
        <Star
          className={cn(size === "sm" ? "size-3.5" : "size-4", "fill-tone-amber text-tone-amber")}
        />
        {showLabel && <span className="text-sm">Of extreme interest</span>}
      </span>
    );
  }

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

      <StarNoteDialog open={noteOpen} onOpenChange={setNoteOpen} label={label} />
    </>
  );
}
