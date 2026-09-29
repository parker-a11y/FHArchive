import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { richTextToPlain } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

export const SCRATCHPAD_QUERY_KEY = ["email-scratchpads"] as const;

export async function fetchEmailScratchpads(): Promise<Record<string, string>> {
  const { data, error } = await (supabase as any)
    .from("email_scratchpads")
    .select("letter_id, body");
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as { letter_id: string; body: string }[]) {
    if (r.body?.trim()) map[r.letter_id] = r.body;
  }
  return map;
}

/** Admin-only private notes for future emails about one record. */
export function EmailScratchpadButton({
  letterId,
  archiveId,
  body,
}: {
  letterId: string;
  archiveId: string;
  body?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(body ?? "");
  const [busy, setBusy] = useState(false);
  const has = Boolean(body?.trim());
  const preview = has ? richTextToPlain(body!).split("\n").find((l) => l.trim()) ?? "" : "";

  const save = async (value: string) => {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const db = supabase as any;
      const { error } = value.trim()
        ? await db.from("email_scratchpads").upsert({
            letter_id: letterId,
            body: value,
            updated_by: u.user?.id ?? null,
          })
        : await db.from("email_scratchpads").delete().eq("letter_id", letterId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: SCRATCHPAD_QUERY_KEY });
      toast.success(value.trim() ? "Note saved" : "Note cleared");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message || "Could not save note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        title={has ? `Email notes: ${preview.slice(0, 80)}` : `Add email notes for ${archiveId}`}
        aria-label={`Email notes for ${archiveId}`}
        onClick={() => {
          setDraft(body ?? "");
          setOpen(true);
        }}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full border transition-colors",
          has
            ? "border-amber-500/60 bg-amber-400/25 text-amber-700 hover:bg-amber-400/40"
            : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
        )}
      >
        <NotebookPen className="size-3" strokeWidth={2.25} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email notes · {archiveId}</DialogTitle>
            <DialogDescription>
              Private scratchpad for future emails. Only admins can see this.
            </DialogDescription>
          </DialogHeader>
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder="Type or paste notes…"
            minHeight="14rem"
          />
          <DialogFooter className="gap-2">
            {has && (
              <Button variant="outline" disabled={busy} onClick={() => save("")}>
                Clear
              </Button>
            )}
            <Button disabled={busy} onClick={() => save(draft)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
