import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Letter } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";

export type SecondProofStatus = "not_started" | "flagged" | "done";

export function secondProofLabel(status: string | null | undefined) {
  if (status === "done") return "Second proof complete";
  if (status === "flagged") return "Needs another look";
  return "Second proof not done";
}

export function secondProofTone(status: string | null | undefined) {
  if (status === "done")
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (status === "flagged")
    return "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200";
  return "border-border bg-muted text-muted-foreground";
}

/**
 * Record-level second proof pass: a light-touch way to flag a record that still
 * needs corrections after the first verification, and mark it finally clean.
 */
export function SecondProofPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const { isGuestViewer, user } = useAuth();
  const current = (letter as unknown as { second_proof_status?: string | null })
    .second_proof_status;
  const currentNotes =
    (letter as unknown as { second_proof_notes?: string | null }).second_proof_notes ?? "";
  const proofedAt = (letter as unknown as { second_proof_at?: string | null }).second_proof_at;

  const [notes, setNotes] = useState(currentNotes);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNotes(currentNotes);
  }, [letter.id, currentNotes]);

  const save = async (status: SecondProofStatus) => {
    setBusy(true);
    const { error } = await supabase
      .from("letters")
      .update({
        second_proof_status: status,
        second_proof_notes: notes.trim() || null,
        second_proof_at: status === "done" ? new Date().toISOString() : null,
        second_proof_by: status === "done" ? (user?.id ?? null) : null,
      })
      .eq("id", letter.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      status === "done"
        ? "Second proof marked complete"
        : status === "flagged"
          ? "Flagged for another look"
          : "Second proof reset",
    );
    qc.invalidateQueries({ queryKey: ["letter", letter.archive_id] });
    qc.invalidateQueries({ queryKey: ["letters"] });
  };

  return (
    <div className="rounded border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">Second proof</h4>
        <span
          className={`rounded border px-2 py-0.5 text-[11px] font-medium ${secondProofTone(current)}`}
        >
          {secondProofLabel(current)}
        </span>
        {current === "done" && proofedAt && (
          <span className="text-[11px] text-muted-foreground">
            {new Date(proofedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        A final pass after verification — flag anything that slipped through, then mark it clean
        once fixed.
      </p>

      {isGuestViewer ? (
        currentNotes ? (
          <p className="text-sm whitespace-pre-wrap">{currentNotes}</p>
        ) : null
      ) : (
        <>
          <Textarea
            className="text-sm"
            rows={2}
            placeholder="What still needs fixing? (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save("flagged")}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Flag className="mr-1 h-4 w-4" />}
              Needs another look
            </Button>
            <Button
              size="sm"
              disabled={busy}
              className={
                current === "done" ? "bg-emerald-600 text-white hover:bg-emerald-700" : undefined
              }
              onClick={() => save("done")}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Mark second proof complete
            </Button>
            {current !== "not_started" && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => save("not_started")}>
                Reset
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
