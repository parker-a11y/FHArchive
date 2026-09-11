import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Boxes, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logEdits } from "@/lib/queries";
import { condenseRanges } from "@/lib/box-ranges";
import logoMark from "@/assets/francis-files-logo.png";

export type BoxRecord = {
  id: string;
  archive_id: string;
  storage_type: string | null;
  storage_location: string | null;
};

/** Only physical file jackets go into a box; photos and digital-only items are ignored. */
export function isFileJacket(r: { storage_type: string | null }) {
  return (r.storage_type ?? "") === "file_jacket";
}

function BoxLabelFace({
  boxName,
  rangeText,
  count,
  dateText,
}: {
  boxName: string;
  rangeText: string;
  count: number;
  dateText: string;
}) {
  return (
    <div className="flex h-[6in] w-[4in] flex-col items-center justify-between border border-border bg-white px-[0.3in] py-[0.35in] text-center">
      <div className="flex flex-col items-center">
        <img src={logoMark} alt="" className="h-[0.7in] w-auto object-contain" />
        <div
          className="mt-[0.06in] font-semibold tracking-[0.16em] text-black uppercase"
          style={{ fontSize: "0.13in" }}
        >
          The Francis Files
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          className="font-semibold tracking-[0.18em] text-black uppercase"
          style={{ fontSize: "0.13in" }}
        >
          Box
        </div>
        <div
          className="archive-id mt-[0.08in] leading-none font-bold text-black"
          style={{ fontSize: boxName.length > 12 ? "0.5in" : "0.75in" }}
        >
          {boxName || "—"}
        </div>
        <div
          className="mt-[0.3in] font-semibold text-black"
          style={{ fontSize: "0.22in", lineHeight: 1.35 }}
        >
          {rangeText || "—"}
        </div>
      </div>

      <div className="w-full">
        <div className="text-black" style={{ fontSize: "0.16in" }}>
          {count} file jacket{count === 1 ? "" : "s"}
        </div>
        <div className="mt-[0.06in] text-black" style={{ fontSize: "0.14in" }}>
          {dateText}
        </div>
      </div>
    </div>
  );
}

function BoxLabelCard(props: Parameters<typeof BoxLabelFace>[0]) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <>
      <div className="no-print mx-auto origin-top scale-[0.62] sm:scale-75">
        <BoxLabelFace {...props} />
      </div>
      {mounted &&
        createPortal(
          <div className="print-label">
            <BoxLabelFace {...props} />
          </div>,
          document.body,
        )}
    </>
  );
}

function todayText() {
  return new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Existing box names, so the archivist can reuse one instead of retyping. */
async function fetchBoxNames(): Promise<string[]> {
  const { data } = await supabase
    .from("letters")
    .select("storage_location")
    .not("storage_location", "is", null)
    .limit(2000);
  const names = new Set<string>();
  for (const row of (data ?? []) as { storage_location: string | null }[]) {
    const v = (row.storage_location ?? "").trim();
    if (v) names.add(v);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function BoxLabelDialog({
  records,
  trigger,
  onApplied,
}: {
  records: BoxRecord[];
  trigger: React.ReactNode;
  onApplied?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [boxName, setBoxName] = useState("");
  const [rangeText, setRangeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);

  const eligible = useMemo(() => records.filter(isFileJacket), [records]);
  const skipped = useMemo(() => records.filter((r) => !isFileJacket(r)), [records]);
  const autoRange = useMemo(
    () => condenseRanges(eligible.map((r) => r.archive_id)),
    [eligible],
  );

  const { data: boxNames = [] } = useQuery({
    queryKey: ["box-names"],
    enabled: open,
    staleTime: 60_000,
    queryFn: fetchBoxNames,
  });

  useEffect(() => {
    if (!open) return;
    setApplied(false);
    setRangeText(autoRange);
    const existing = eligible.find((r) => (r.storage_location ?? "").trim());
    setBoxName((existing?.storage_location ?? "").trim());
  }, [open, autoRange, eligible]);

  async function apply() {
    const name = boxName.trim();
    if (!name) {
      toast.error("Give the box a name first.");
      return;
    }
    if (!eligible.length) {
      toast.error("No file jackets in this selection.");
      return;
    }
    setSaving(true);
    try {
      const ids = eligible.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const { error } = await supabase
          .from("letters")
          .update({ storage_location: name } as never)
          .in("id", chunk);
        if (error) throw error;
      }
      await Promise.all(
        eligible.map((r) =>
          logEdits(r.id, { storage_location: r.storage_location }, { storage_location: name }),
        ),
      );
      setApplied(true);
      toast.success(
        `Assigned ${eligible.length} record${eligible.length === 1 ? "" : "s"} to ${name}.`,
      );
      onApplied?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle>Assign to box &amp; print box label</DialogTitle>

        <div className="no-print space-y-3">
          <div>
            <label className="field-label">Box name</label>
            <Input
              list="box-name-options"
              value={boxName}
              onChange={(e) => {
                setBoxName(e.target.value);
                setApplied(false);
              }}
              placeholder="e.g. Box 3"
            />
            <datalist id="box-name-options">
              {boxNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div className="rounded border border-border bg-muted/40 p-3 text-sm">
            <div>
              <span className="font-semibold">{eligible.length}</span> file jacket
              {eligible.length === 1 ? "" : "s"} will be assigned.
            </div>
            {skipped.length > 0 && (
              <div className="mt-1 text-muted-foreground">
                Skipping {skipped.length} record{skipped.length === 1 ? "" : "s"} that are not
                file jackets: {skipped.map((r) => r.archive_id).join(", ")}
              </div>
            )}
          </div>

          <div>
            <label className="field-label">Records on the label</label>
            <Input value={rangeText} onChange={(e) => setRangeText(e.target.value)} />
          </div>
        </div>

        <div className="no-print flex flex-col items-start gap-6 sm:flex-row">
          <div className="flex-1">
            <BoxLabelCard
              boxName={boxName}
              rangeText={rangeText}
              count={eligible.length}
              dateText={todayText()}
            />
          </div>
          <div className="flex shrink-0 flex-col justify-center gap-3 self-center sm:self-stretch">
            <Button
              className="h-20 w-48 flex-col gap-1"
              disabled={saving || !eligible.length}
              onClick={apply}
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : <Boxes className="size-5" />}
              <span className="text-sm leading-tight">
                {applied ? "Assigned ✓" : `Assign ${eligible.length} to box`}
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-20 w-48 flex-col gap-1"
              onClick={() => {
                const close = () => setOpen(false);
                window.addEventListener("afterprint", close, { once: true });
                window.print();
                setTimeout(() => {
                  window.removeEventListener("afterprint", close);
                  setOpen(false);
                }, 300);
              }}
            >
              <Printer className="size-5" />
              <span className="text-sm leading-tight">Print box label</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
