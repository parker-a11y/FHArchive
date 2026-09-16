import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import type { Letter } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Second review: a single checkbox per record. Tick it once a second pass
 * (same person or a second set of eyes) has gone through the verified
 * transcription and fixed any small typos.
 */
export function SecondProofPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const { isGuestViewer } = useAuth();
  const checked =
    (letter as unknown as { second_reviewed?: boolean | null }).second_reviewed ?? false;
  const [busy, setBusy] = useState(false);

  const toggle = async (value: boolean) => {
    setBusy(true);
    const { error } = await supabase
      .from("letters")
      .update({ second_reviewed: value })
      .eq("id", letter.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["letter", letter.archive_id] });
    qc.invalidateQueries({ queryKey: ["letters"] });
  };

  if (isGuestViewer) return null;

  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${
        checked
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-border bg-card"
      }`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => toggle(v === true)}
          disabled={busy}
        />
      )}
      <span>
        Second review
        {checked && <span className="ml-1 text-xs">✓</span>}
      </span>
    </label>
  );
}
