import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { labelDate, labelOf, PERIODS } from "@/lib/archive";
import type { Letter } from "@/lib/queries";

type LabelProps = {
  archiveId: string;
  dateText: string;
  title?: string;
  lines?: string[];
};

/**
 * Pure 4×6 label card — shown scaled on screen, and printed once from a
 * body-level portal so no dialog/app markup can spill onto extra label stock.
 */
export function LabelCard(props: LabelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <div className="no-print mx-auto origin-top scale-[0.62] sm:scale-75">
        <LabelFace {...props} />
      </div>
      {mounted &&
        createPortal(
          <div className="print-label">
            <LabelFace {...props} />
          </div>,
          document.body,
        )}
    </>
  );
}

function LabelFace({ archiveId, dateText, title = "", lines = [] }: LabelProps) {
  return (
    <div className="flex h-[6in] w-[4in] flex-col items-center justify-center border border-border bg-white text-center">
      <div
        className="archive-id leading-none font-bold text-black"
        style={{ fontSize: "1.1in", letterSpacing: "0.02em" }}
      >
        {archiveId}
      </div>
      {title.trim() !== "" && (
        <div
          className="mt-[0.25in] px-[0.3in] font-semibold text-black"
          style={{ fontSize: "0.26in", lineHeight: 1.25 }}
        >
          {title}
        </div>
      )}
      <div
        className="mt-[0.35in] font-semibold text-black"
        style={{ fontSize: "0.32in", letterSpacing: "0.04em" }}
      >
        {dateText}
      </div>
      {lines.length > 0 && (
        <div className="mt-[0.3in] space-y-[0.08in] px-[0.35in]">
          {lines.map((l, i) => (
            <div key={i} className="text-black" style={{ fontSize: "0.2in", lineHeight: 1.3 }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrintButton() {
  return (
    <Button className="no-print gap-2" onClick={() => window.print()}>
      <Printer className="size-4" /> Print to label printer
    </Button>
  );
}

export function labelLines(letter: Partial<Letter>): string[] {
  const lines: string[] = [];
  const fromTo = [letter.author && `From: ${letter.author}`, letter.recipient && `To: ${letter.recipient}`]
    .filter(Boolean)
    .join("  ·  ");
  if (fromTo) lines.push(fromTo);
  const route = [letter.origin, letter.destination].filter(Boolean).join(" → ");
  if (route) lines.push(route);
  const extras: string[] = [];
  if (letter.period && letter.period !== "unknown")
    extras.push(labelOf(PERIODS, letter.period));
  if (letter.sheets) extras.push(`${letter.sheets} sheet${letter.sheets === 1 ? "" : "s"}`);
  if (letter.has_envelope) extras.push("envelope");
  if (letter.has_enclosures) extras.push("enclosures");
  if (extras.length) lines.push(extras.join(" · "));
  if (letter.notes) lines.push(letter.notes.length > 90 ? letter.notes.slice(0, 90) + "…" : letter.notes);
  return lines;
}

/** Title / short description shown under the FH number. */
export function labelTitle(letter: Partial<Letter>): string {
  const raw = (letter.title ?? "").trim() || (letter.physical_description ?? "").trim();
  if (!raw) return "";
  return raw.length > 80 ? raw.slice(0, 80) + "…" : raw;
}

export function LabelDialog({ letter }: { letter: Letter }) {
  const [open, setOpen] = useState(false);
  const [dateText, setDateText] = useState(labelDate(letter));
  const [titleText, setTitleText] = useState(labelTitle(letter));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setDateText(labelDate(letter));
          setTitleText(labelTitle(letter));
        }
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
          <label className="field-label">Title / short description</label>
          <Input
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            placeholder="e.g. Bell Bottom Trousers — handwritten lyrics"
          />
          <label className="field-label">Date line</label>
          <Input value={dateText} onChange={(e) => setDateText(e.target.value.toUpperCase())} />
          <p className="text-xs text-muted-foreground">
            Use e.g. JUNE 14, 1943 · JUNE 1943 · C. 1943 · DATE UNKNOWN
          </p>
        </div>

        <LabelCard
          archiveId={letter.archive_id}
          dateText={dateText}
          title={titleText}
          lines={labelLines(letter)}
        />

        <PrintButton />
      </DialogContent>
    </Dialog>
  );
}

/** Controlled variant used by Quick Entry right after saving a new record. */
export function EntryLabelDialog({
  open,
  onOpenChange,
  archiveId,
  defaultDate,
  defaultTitle = "",
  lines,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  archiveId: string;
  defaultDate: string;
  defaultTitle?: string;
  lines: string[];
}) {
  const [dateText, setDateText] = useState(defaultDate);
  const [titleText, setTitleText] = useState(defaultTitle);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setDateText(defaultDate);
          setTitleText(defaultTitle);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogTitle>4 × 6 Folder Label — {archiveId}</DialogTitle>
        <div className="no-print space-y-2">
          <label className="field-label">Title / short description</label>
          <Input value={titleText} onChange={(e) => setTitleText(e.target.value)} />
          <label className="field-label">Date line</label>
          <Input value={dateText} onChange={(e) => setDateText(e.target.value.toUpperCase())} />
        </div>

        <LabelCard
          archiveId={archiveId}
          dateText={dateText}
          title={titleText}
          lines={lines}
        />

        <PrintButton />
      </DialogContent>
    </Dialog>
  );
}
