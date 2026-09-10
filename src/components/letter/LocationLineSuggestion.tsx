/**
 * Suggested Location Line — the AI's reading of the place written at the head
 * of the letter. Tap to accept into the real field, or type a correction in
 * the field itself. Nothing is applied without the archivist's action.
 */

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestLocationLines } from "@/lib/location-line.functions";

type Props = {
  letterId: string;
  suggestion: string | null | undefined;
  current: string;
  onAccept: (value: string) => void;
  disabled?: boolean;
};

export function LocationLineSuggestion({ letterId, suggestion, current, onAccept, disabled }: Props) {
  const qc = useQueryClient();
  const run = useServerFn(suggestLocationLines);
  const [local, setLocal] = useState<string | null | undefined>(suggestion);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLocal(suggestion), [suggestion, letterId]);

  const value = (local ?? "").trim();
  const checked = local !== null && local !== undefined;
  const matches = value && value.toLowerCase() === current.trim().toLowerCase();

  async function refresh() {
    setBusy(true);
    try {
      const r = await run({ data: { letterIds: [letterId], force: true, limit: 1 } });
      const result = r.results[0];
      if (!result) throw new Error("This record could not be checked. Please try again.");
      const s = result.suggestion ?? "";
      setLocal(s);
      if (!s) toast.message("No location line found on this letter.");
      qc.invalidateQueries({ queryKey: ["letters"] });
      qc.invalidateQueries({ queryKey: ["letter"] });
      qc.invalidateQueries({ queryKey: ["envelope-records"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get a suggestion");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Suggested location line:</span>
      {value && !matches ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 gap-1 px-2 text-xs"
          disabled={disabled}
          onClick={() => onAccept(value)}
          title="Tap to accept"
        >
          <Check className="size-3" />
          {value}
        </Button>
      ) : (
        <span className="text-muted-foreground italic">
          {matches ? "accepted" : checked ? "none found" : "not checked yet"}
        </span>
      )}
      {!disabled && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          disabled={busy}
          onClick={refresh}
        >
          <Sparkles className="size-3" />
          {busy ? "Reading…" : checked ? "Ask AI again" : "Ask AI"}
        </Button>
      )}
    </div>
  );
}
