import { useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { labelDate } from "@/lib/archive";
import { MULTI_LABEL_MAX, unprintedRun } from "@/lib/multi-label";
import type { Letter } from "@/lib/queries";
import { JacketEntryDialog } from "./JacketLabelDialog";

/** Pick this record plus the unprinted records just before it, review, then print one label. */
export function MultiLabelDialog({ letter }: { letter: Letter }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Letter[]>([]);
  const [stoppedAt, setStoppedAt] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  async function load() {
    setReviewOpen(true);
    setLoading(true);
    setError("");
    try {
      const { data, error: e } = await supabase
        .from("letters")
        .select("*")
        .lte("fh_seq", letter.fh_seq)
        .neq("record_type", "moved_to_gallery")
        .order("fh_seq", { ascending: false })
        .limit(MULTI_LABEL_MAX + 1);
      if (e) throw e;
      const rows = (data ?? []) as Letter[];
      const { data: printedRows, error: pe } = await supabase
        .from("label_prints")
        .select("letter_id")
        .in("letter_id", rows.map((r) => r.id));
      if (pe) throw pe;
      const printed = new Set((printedRows ?? []).map((p) => p.letter_id));
      // The current record is always offered, even if it was printed before.
      const run = [rows[0], ...unprintedRun(rows.slice(1), printed, MULTI_LABEL_MAX - 1)].filter(Boolean);
      const stop = rows.slice(run.length).find((r) => printed.has(r.id));
      setStoppedAt(stop ? stop.archive_id : null);
      setCandidates(run);
      setChecked(new Set(run.map((r) => r.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load records");
    } finally {
      setLoading(false);
    }
  }

  const selected = candidates.filter((c) => checked.has(c.id));

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={load}>
        <Layers className="size-4" /> Print Multiple Labels
      </Button>
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Print Multiple Labels</DialogTitle>
          <DialogDescription>
            Review the records for this label. These are {letter.archive_id} and the records before it
            that haven't had a label printed
            {stoppedAt ? `, back to the last printed label (${stoppedAt}).` : candidates.length >= MULTI_LABEL_MAX ? ` (up to ${MULTI_LABEL_MAX}).` : "."}
          </DialogDescription>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && (
            <div className="max-h-[50vh] space-y-1 overflow-y-auto rounded-md border p-2">
              {candidates.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-muted">
                  <Checkbox
                    checked={checked.has(c.id)}
                    onCheckedChange={(v) =>
                      setChecked((prev) => {
                        const n = new Set(prev);
                        if (v) n.add(c.id);
                        else n.delete(c.id);
                        return n;
                      })
                    }
                  />
                  <span className="font-mono text-sm font-semibold">{c.archive_id}</span>
                  <span className="text-xs text-muted-foreground">{labelDate(c)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={selected.length === 0}
              onClick={() => {
                setReviewOpen(false);
                setPrintOpen(true);
              }}
            >
              Confirm {selected.length} record{selected.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <JacketEntryDialog letters={selected} open={printOpen} onOpenChange={setPrintOpen} />
    </>
  );
}
