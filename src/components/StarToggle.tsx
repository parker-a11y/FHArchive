import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { postArchiveNote } from "@/lib/archive-notes";
import { cn } from "@/lib/utils";
import { FffBadge, FFF_NAME, FFF_SHORT } from "@/components/FffBadge";
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
  const [title, setTitle] = useState(`${FFF_SHORT} — ${FFF_NAME}`);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(`${FFF_SHORT} — ${FFF_NAME}`);
      setBody(`New Francis File Find: ${label}.`);
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
          <DialogTitle className="flex items-center gap-2">
            <FffBadge size={22} /> Post an FFF note?
          </DialogTitle>
          <DialogDescription>
            This item is flagged as a Francis File Find. Add or edit the note shown to anyone
            browsing the archive, or skip it — the FFF mark is already saved.
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

export function StarToggle(_props: {
  table: Table;
  id: string;
  starred: boolean;
  label: string;
  size?: "icon" | "sm";
  showLabel?: boolean;
  className?: string;
}) {
  // FFF concept removed — the toggle no longer renders anywhere.
  return null;
}
