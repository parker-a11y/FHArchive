import { useState } from "react";
import { Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { labelDate } from "@/lib/archive";
import { condenseRanges } from "@/lib/box-ranges";
import type { Letter } from "@/lib/queries";
import { EntryLabelDialog } from "./LabelDialog";

/** Controlled 4×6 label covering several FH records (shared by jacket and multi-label). */
export function JacketEntryDialog({
  letters: input,
  open,
  onOpenChange,
}: {
  letters: Letter[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const letters = [...input].sort((a, b) => a.archive_id.localeCompare(b.archive_id));
  const idText = condenseRanges(letters.map((l) => l.archive_id));
  // More than 4 records: drop descriptions, list only FH number and date.
  const compact = letters.length > 4;
  const maxLines = compact ? 30 : 12;
  const lines = letters.map((l) => {
    if (compact) return [l.archive_id, labelDate(l)].filter(Boolean).join(" · ");
    const t = (l.title ?? "").trim();
    const short = t.length > 40 ? t.slice(0, 40) + "…" : t;
    return [l.archive_id, labelDate(l), short].filter(Boolean).join(" · ");
  });
  const dates = letters.map((l) => labelDate(l)).filter(Boolean);
  const dateText =
    dates.length === 0 ? "" : dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`;
  if (!open || letters.length === 0) return null;
  return (
    <EntryLabelDialog
      key={idText}
      open={open}
      onOpenChange={onOpenChange}
      archiveId={idText}
      defaultDate={dateText}
      defaultTitle={`${letters.length} records in this jacket`}
      lines={lines.length > maxLines ? [...lines.slice(0, maxLines - 1), `+ ${lines.length - maxLines + 1} more`] : lines}
      compactLines={compact}
      printedIds={letters.map((l) => l.id)}
      idFontSize={idText.length > 14 ? "0.45in" : idText.length > 7 ? "0.6in" : undefined}
    />
  );
}

/** One 4×6 folder label covering several FH records that share a file jacket. */
export function JacketLabelDialog({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState(false);
  const { data: letters = [] } = useQuery({
    queryKey: ["jacket-label", [...ids].sort()],
    enabled: open && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("letters").select("*").in("id", ids);
      if (error) throw error;
      return (data ?? []) as Letter[];
    },
  });
  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Printer className="size-4" /> Jacket label ({ids.length})
      </Button>
      <JacketEntryDialog letters={letters} open={open} onOpenChange={setOpen} />
    </>
  );
}
