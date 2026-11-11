import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, Tag } from "lucide-react";
import logoMark from "@/assets/francis-files-logo.png";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { printLabelNow } from "./LabelDialog";

type Face = { heading: string; title: string; dateText: string; lines: string[] };

/** 4×6 face matching jacket/box labels, plus a small Francis Files logo. Never saved. */
function CustomFace({ heading, title, dateText, lines }: Face) {
  const idSize = heading.length > 14 ? "0.45in" : heading.length > 7 ? "0.6in" : "1.1in";
  return (
    <div className="relative flex h-[6in] w-[4in] flex-col items-center justify-center border border-border bg-white text-center">
      <img src={logoMark} alt="The Francis Files" className="absolute top-[0.2in] left-1/2 h-[0.6in] w-[0.6in] -translate-x-1/2 object-contain" />
      {heading.trim() && (
        <div className="archive-id leading-none font-bold text-black" style={{ fontSize: idSize, letterSpacing: "0.02em" }}>
          {heading}
        </div>
      )}
      {title.trim() && (
        <div className="mt-[0.25in] px-[0.3in] font-semibold text-black" style={{ fontSize: "0.26in", lineHeight: 1.25 }}>
          {title}
        </div>
      )}
      {dateText.trim() && (
        <div className="mt-[0.35in] font-semibold text-black" style={{ fontSize: "0.32in", letterSpacing: "0.04em" }}>
          {dateText}
        </div>
      )}
      {lines.length > 0 && (
        <div className="mt-[0.3in] space-y-[0.08in] px-[0.35in]">
          {lines.map((l, i) => (
            <div key={i} className="text-black" style={{ fontSize: "0.2in", lineHeight: 1.3 }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomLabelDialog() {
  const [open, setOpen] = useState(false);
  const [heading, setHeading] = useState("");
  const [title, setTitle] = useState("");
  const [dateText, setDateText] = useState("");
  const [body, setBody] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const face: Face = { heading, title, dateText, lines: body.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12) };

  const reset = (o: boolean) => {
    setOpen(o);
    if (!o) { setHeading(""); setTitle(""); setDateText(""); setBody(""); }
  };

  return (
    <>
      <Button size="sm" variant="outline" className="w-full justify-center gap-2 rounded-full sm:w-auto" onClick={() => setOpen(true)}>
        <Tag className="size-4" /> PRINT LABEL
      </Button>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Print a one-time label</DialogTitle>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div><Label>Large heading</Label><Input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="e.g. BOX 12" /></div>
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Date</Label><Input value={dateText} onChange={(e) => setDateText(e.target.value)} /></div>
              <div><Label>Extra lines (one per line)</Label><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
              <p className="text-xs text-muted-foreground">This label is not saved.</p>
              <Button className="gap-2" onClick={() => printLabelNow(() => reset(false))}>
                <Printer className="size-4" /> Print to label printer
              </Button>
            </div>
            <div className="h-[4.5in] w-[3in] overflow-hidden">
              <div className="origin-top-left scale-75"><CustomFace {...face} /></div>
            </div>
          </div>
          {open && mounted && createPortal(<div className="print-label"><CustomFace {...face} /></div>, document.body)}
        </DialogContent>
      </Dialog>
    </>
  );
}
