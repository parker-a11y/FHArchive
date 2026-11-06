import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryLabelDialog } from "@/components/letter/LabelDialog";
import { condenseRanges } from "@/lib/box-ranges";

type Sleeve = { code: string; name: string | null; created_at: string };

/** Opens the standard 4×6 label dialog for a photo sleeve (same printer flow as FH folder labels). */
export function SleeveLabelButton({ sleeve, phIds, boxCode }: { sleeve: Sleeve; phIds: string[]; boxCode?: string | null }) {
  const [open, setOpen] = useState(false);
  const date = new Date(sleeve.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
  const lines = [
    `${phIds.length} photograph${phIds.length === 1 ? "" : "s"}`,
    phIds.length ? condenseRanges(phIds) : "",
    boxCode ? `Box: ${boxCode}` : "",
  ].filter(Boolean);
  return (
    <>
      <Button size="icon" variant="ghost" className="size-7" aria-label={`Print label for ${sleeve.code}`} title="Print sleeve label" onClick={() => setOpen(true)}>
        <Printer className="size-3.5" />
      </Button>
      {open && (
        <EntryLabelDialog open={open} onOpenChange={setOpen} archiveId={sleeve.code.replace("-", " ")} idFontSize="0.62in"
          defaultDate={date} defaultTitle={sleeve.name ?? ""} lines={lines} />
      )}
    </>
  );
}
