import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createToneOption } from "@/lib/tones";
import { logEdits } from "@/lib/queries";

export type ToneProposal = {
  letterId: string;
  archiveId: string;
  existing: string[];
  matched: string[];
  proposed: string[];
};

type Key = string;
const keyOf = (letterId: string, tone: string) => `${letterId}::${tone.toLowerCase()}`;

/**
 * Review dialog for AI-suggested tone / sentiment values. Nothing is written
 * to a record until the archivist confirms here.
 */
export function ConfirmTonesDialog({
  open,
  proposals,
  onCancel,
  onDone,
}: {
  open: boolean;
  proposals: ToneProposal[];
  onCancel: () => void;
  onDone: (applied: number) => void;
}) {
  const [selected, setSelected] = useState<Set<Key>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = new Set<Key>();
    for (const p of proposals) {
      for (const t of [...p.matched, ...p.proposed]) next.add(keyOf(p.letterId, t));
    }
    setSelected(next);
  }, [open, proposals]);

  const total = useMemo(() => selected.size, [selected]);

  function toggle(letterId: string, tone: string) {
    const k = keyOf(letterId, tone);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function apply() {
    setBusy(true);
    let applied = 0;
    try {
      // Create any newly approved tone options once, then save per record.
      const newTones = new Set<string>();
      for (const p of proposals) {
        for (const t of p.proposed) if (selected.has(keyOf(p.letterId, t))) newTones.add(t);
      }
      for (const t of newTones) {
        try {
          await createToneOption(t);
        } catch {
          /* already exists — selectable either way */
        }
      }

      for (const p of proposals) {
        const chosen = [...p.matched, ...p.proposed].filter((t) =>
          selected.has(keyOf(p.letterId, t)),
        );
        if (!chosen.length) continue;
        const merged = Array.from(new Set([...(p.existing ?? []), ...chosen]));
        const { error } = await supabase
          .from("letters")
          .update({ tones: merged } as never)
          .eq("id", p.letterId);
        if (error) throw new Error(error.message);
        await logEdits(p.letterId, { tones: p.existing ?? [] }, { tones: merged });
        applied++;
      }
      onDone(applied);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save tone selections");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm tone / sentiment</DialogTitle>
          <DialogDescription>
            AI suggested the tones below from the transcription. Uncheck anything you don&apos;t
            want; nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {proposals.length === 0 && (
            <p className="text-sm text-muted-foreground">No tone suggestions were returned.</p>
          )}
          {proposals.map((p) => (
            <div key={p.letterId} className="rounded border border-border p-3">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="archive-id text-sm font-semibold">{p.archiveId}</span>
                {p.existing.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    already: {p.existing.join(", ")}
                  </span>
                )}
              </div>
              {p.matched.length === 0 && p.proposed.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tones detected.</p>
              ) : (
                <div className="space-y-1.5">
                  {p.matched.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.has(keyOf(p.letterId, t))}
                        onCheckedChange={() => toggle(p.letterId, t)}
                      />
                      {t}
                    </label>
                  ))}
                  {p.proposed.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.has(keyOf(p.letterId, t))}
                        onCheckedChange={() => toggle(p.letterId, t)}
                      />
                      {t}
                      <span className="rounded bg-archive-ai-surface px-1.5 py-0.5 text-xs text-archive-ai">
                        new tone — will be added to the list
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || total === 0}>
            {busy ? "Saving…" : `Confirm ${total} tone${total === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
