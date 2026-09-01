import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestTones } from "@/lib/tone-suggest.functions";
import { mergeToneOptions, toneEligible } from "@/lib/tones";
import { useToneOptions } from "@/components/ToneMultiSelect";
import { ConfirmTonesDialog, type ToneProposal } from "@/components/ai/ConfirmTonesDialog";
import type { Letter } from "@/lib/queries";

const BATCH_LIMIT = 25;

/**
 * Backfills tone / sentiment on older correspondence records that have none.
 * Records are processed one at a time (bounded per run) and every suggestion
 * is confirmed by the archivist before anything is saved.
 */
export function ToneBackfillCard({ letters }: { letters: Letter[] }) {
  const qc = useQueryClient();
  const run = useServerFn(suggestTones);
  const { data: toneOptions = [] } = useToneOptions();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [proposals, setProposals] = useState<ToneProposal[] | null>(null);

  const pending = letters.filter(
    (l) => toneEligible(l.record_type, l.subtype) && (l.tones ?? []).length === 0,
  );

  async function start() {
    const batch = pending.slice(0, BATCH_LIMIT);
    if (!batch.length) return;
    setProgress({ done: 0, total: batch.length });
    const vocabulary = mergeToneOptions(toneOptions);
    const out: ToneProposal[] = [];
    for (let i = 0; i < batch.length; i++) {
      const l = batch[i]!;
      try {
        const res = await run({ data: { letterId: l.id, vocabulary } });
        if (!res.skipped && (res.matched.length || res.proposed.length)) {
          out.push({
            letterId: l.id,
            archiveId: l.archive_id,
            existing: [],
            matched: res.matched,
            proposed: res.proposed,
          });
        }
      } catch (e) {
        toast.error(`${l.archive_id}: ${e instanceof Error ? e.message : "tone suggestion failed"}`);
        break; // stop the run on a gateway failure rather than looping
      }
      setProgress({ done: i + 1, total: batch.length });
    }
    setProgress(null);
    if (!out.length) {
      toast.info("No tone suggestions were returned for these records.");
      return;
    }
    setProposals(out);
  }

  return (
    <div className="rounded border border-border bg-card p-4">
      <ConfirmTonesDialog
        open={!!proposals}
        proposals={proposals ?? []}
        onCancel={() => setProposals(null)}
        onDone={(n) => {
          setProposals(null);
          qc.invalidateQueries({ queryKey: ["letters"] });
          qc.invalidateQueries({ queryKey: ["tone_options"] });
          toast.success(`Tone / sentiment saved on ${n} record(s)`);
        }}
      />
      <h2 className="field-label">Tone / sentiment backfill</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {pending.length} correspondence record(s) have no tone yet. Suggestions are reviewed before
        anything is saved. Up to {BATCH_LIMIT} records per run.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={start} disabled={!pending.length || !!progress}>
          {progress ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 size-3.5" />
          )}
          Suggest tones ({Math.min(pending.length, BATCH_LIMIT)})
        </Button>
        {progress && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {progress.done} / {progress.total}
          </span>
        )}
      </div>
    </div>
  );
}
