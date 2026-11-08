import { useState } from "react";
import { Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { labelDate } from "@/lib/archive";
import { condenseRanges } from "@/lib/box-ranges";
import type { Letter } from "@/lib/queries";
import { EntryLabelDialog } from "./LabelDialog";

/** One 4×6 folder label covering several FH records that share a file jacket. */
export function JacketLabelDialog({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState(false);
  const { data: letters = [] } = useQuery({
    queryKey: ["jacket-label", [...ids].sort()],
    enabled: open && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("letters").select("*").in("id", ids);
      if (error) throw error;
      return ((data ?? []) as Letter[]).sort((a, b) => a.archive_id.localeCompare(b.archive_id));
    },
  });

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

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Printer className="size-4" /> Jacket label ({ids.length})
      </Button>
      {open && letters.length > 0 && (
        <EntryLabelDialog
          key={idText}
          open={open}
          onOpenChange={setOpen}
          archiveId={idText}
          defaultDate={dateText}
          defaultTitle={`${letters.length} records in this jacket`}
          lines={lines.length > maxLines ? [...lines.slice(0, maxLines - 1), `+ ${lines.length - maxLines + 1} more`] : lines}
          compactLines={compact}
          idFontSize={idText.length > 14 ? "0.45in" : idText.length > 7 ? "0.6in" : undefined}
        />
      )}
    </>
  );
}
