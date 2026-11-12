import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { labelDate, labelOf, PERIODS } from "@/lib/archive";
import type { Letter } from "@/lib/queries";
import { LabelFrame } from "./LabelFrame";
import { supabase } from "@/integrations/supabase/client";

/** Remember which records have had a folder label printed (for Print Multiple Labels). */
export async function markLabelsPrinted(ids: string[]) {
  if (!ids.length) return;
  const { data } = await supabase.auth.getUser();
  await supabase.from("label_prints").upsert(
    ids.map((letter_id) => ({ letter_id, printed_at: new Date().toISOString(), printed_by: data.user?.id ?? null })),
  );
}

type LabelProps = {
  archiveId: string;
  dateText: string;
  title?: string;
  lines?: string[];
  /** Override the big identifier size for longer IDs (e.g. "SLEEVE 001"). */
  idFontSize?: string;
  /** Compact list (jacket labels with many records): smaller text, two columns when long. */
  compactLines?: boolean;
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

function LabelFace({ archiveId, dateText, title = "", lines = [], idFontSize = "1.1in", compactLines = false }: LabelProps) {
  const twoCol = compactLines && lines.length > 12;
  const compactSize = lines.length > 20 ? "0.12in" : twoCol ? "0.13in" : "0.18in";
  return (
    <LabelFrame>
      <div
        className="archive-id w-full leading-none font-bold"
        style={{ fontSize: idFontSize }}
      >
        {archiveId}
      </div>
      {title.trim() !== "" && (
        <div
          className="mt-[0.25in] w-full font-semibold"
          style={{ fontSize: "0.26in", lineHeight: 1.25 }}
        >
          {title}
        </div>
      )}
      <div
        className="mt-[0.35in] w-full font-semibold"
        style={{ fontSize: "0.32in" }}
      >
        {dateText}
      </div>
      {lines.length > 0 && compactLines && (
        <div
          className={`mt-[0.25in] w-full ${twoCol ? "grid grid-cols-2 gap-x-[0.15in]" : ""}`}
          style={{ fontSize: compactSize, lineHeight: 1.3, gridAutoFlow: twoCol ? "row" : undefined }}
        >
          {lines.map((l, i) => (
            <div key={i} className="min-w-0">
              {l}
            </div>
          ))}
        </div>
      )}
      {lines.length > 0 && !compactLines && (
        <div className="mt-[0.3in] w-full space-y-[0.08in]">
          {lines.map((l, i) => (
            <div key={i} style={{ fontSize: "0.2in", lineHeight: 1.3 }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </LabelFrame>
  );
}

export function printLabelNow(onDone: () => void) {
  // Printing blocks; close once the browser's print dialog is dismissed.
  const close = () => onDone();
  window.addEventListener("afterprint", close, { once: true });
  window.print();
  setTimeout(() => {
    window.removeEventListener("afterprint", close);
    onDone();
  }, 300);
}

function PrintButton({ onDone, size = "default", printedIds }: { onDone: () => void; size?: "default" | "large"; printedIds?: string[] }) {
  const isLarge = size === "large";
  return (
    <Button
      className={`no-print gap-2 ${isLarge ? "h-40 w-48 flex-col text-xl" : ""}`}
      onClick={() => {
        if (printedIds) void markLabelsPrinted(printedIds);
        printLabelNow(onDone);
      }}
    >
      <Printer className={isLarge ? "size-10" : "size-4"} />
      <span className="text-center leading-tight">
        Print to
        <br />
        label printer
      </span>
    </Button>
  );
}

/** Enter anywhere in the label dialog prints the label (unless a button/textarea has focus). */
function handleEnterToPrint(e: React.KeyboardEvent, onDone: () => void, printedIds?: string[]) {
  if (e.key !== "Enter" || e.shiftKey) return;
  const target = e.target as HTMLElement;
  if (target.closest("textarea") || target.closest("button")) return;
  e.preventDefault();
  if (printedIds) void markLabelsPrinted(printedIds);
  printLabelNow(onDone);
}

export function labelLines(letter: Partial<Letter>): string[] {
  const lines: string[] = [];
  const fromTo = [letter.author && `From: ${letter.author}`, letter.recipient && `To: ${letter.recipient}`]
    .filter(Boolean)
    .join("  ·  ");
  if (fromTo) lines.push(fromTo);
  if (letter.dateline) lines.push(`Location line: ${letter.dateline}`);
  const route = [letter.origin, letter.destination].filter(Boolean).join(" → ");
  if (route) lines.push(route);
  const extras: string[] = [];
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
        <Button variant="outline" className="gap-2" data-shortcut="print-label">
          <Printer className="size-4" /> Print Folder Label
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl" onKeyDown={(e) => handleEnterToPrint(e, () => setOpen(false), [letter.id])}>
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

        <div className="no-print flex flex-col items-start gap-6 sm:flex-row">
          <div className="flex-1">
            <LabelCard
              archiveId={letter.archive_id}
              dateText={dateText}
              title={titleText}
              lines={labelLines(letter)}
            />
          </div>
          <div className="flex shrink-0 items-center self-center sm:self-stretch">
            <PrintButton onDone={() => setOpen(false)} size="large" printedIds={[letter.id]} />
          </div>
        </div>
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
  idFontSize,
  compactLines,
  printedIds,
}: {
  printedIds?: string[];
  idFontSize?: string;
  compactLines?: boolean;
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
      <DialogContent
        className="sm:max-w-3xl"
        onKeyDown={(e) => handleEnterToPrint(e, () => onOpenChange(false), printedIds)}
      >
        <DialogTitle>4 × 6 Folder Label — {archiveId}</DialogTitle>
        <div className="no-print space-y-2">
          <label className="field-label">Title / short description</label>
          <Input value={titleText} onChange={(e) => setTitleText(e.target.value)} />
          <label className="field-label">Date line</label>
          <Input value={dateText} onChange={(e) => setDateText(e.target.value.toUpperCase())} />
        </div>

        <div className="no-print flex flex-col items-start gap-6 sm:flex-row">
          <div className="flex-1">
            <LabelCard
              archiveId={archiveId}
              dateText={dateText}
              title={titleText}
              lines={lines}
              idFontSize={idFontSize}
              compactLines={compactLines}
            />
          </div>
          <div className="flex shrink-0 items-center self-center sm:self-stretch">
            <PrintButton onDone={() => onOpenChange(false)} size="large" printedIds={printedIds} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
