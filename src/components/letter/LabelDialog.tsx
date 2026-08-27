import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { labelDate } from "@/lib/archive";
import type { Letter } from "@/lib/queries";

export function LabelDialog({ letter }: { letter: Letter }) {
  const [open, setOpen] = useState(false);
  const [dateText, setDateText] = useState(labelDate(letter));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setDateText(labelDate(letter));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Printer className="size-4" /> Print Folder Label
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>4 × 6 Folder Label</DialogTitle>
        <div className="no-print space-y-2">
          <label className="field-label">Date line</label>
          <Input value={dateText} onChange={(e) => setDateText(e.target.value.toUpperCase())} />
          <p className="text-xs text-muted-foreground">
            Use e.g. JUNE 14, 1943 · JUNE 1943 · C. 1943 · DATE UNKNOWN
          </p>
        </div>

        <div className="print-label mx-auto flex h-[6in] w-[4in] max-w-full origin-top scale-[0.62] flex-col items-center justify-center border border-border bg-white text-center sm:scale-75">
          <div
            className="archive-id leading-none text-black"
            style={{ fontSize: "0.95in", letterSpacing: "0.02em" }}
          >
            {letter.archive_id}
          </div>
          <div
            className="mt-[0.4in] font-semibold text-black"
            style={{ fontSize: "0.34in", letterSpacing: "0.04em" }}
          >
            {dateText}
          </div>
        </div>

        <Button className="no-print gap-2" onClick={() => window.print()}>
          <Printer className="size-4" /> Print to MUNBYN RW403B
        </Button>
      </DialogContent>
    </Dialog>
  );
}
