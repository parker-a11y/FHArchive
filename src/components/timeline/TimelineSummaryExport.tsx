import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { displayDate } from "@/lib/archive";
import { buildCsv, buildDocHtml, recordFields, sortExportRows, type SummaryExportRow } from "@/lib/timeline-export";
import type { fetchLetters } from "@/lib/queries";

export type Letter = Awaited<ReturnType<typeof fetchLetters>>[number];
type Format = "pdf" | "doc" | "csv";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function loadRows(letters: Letter[]): Promise<SummaryExportRow[]> {
  const ids = letters.map((l) => l.id);
  const summaries = new Map<string, string>();
  const people = new Map<string, Set<string>>();
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const { data, error } = await supabase.from("letters").select("id, summary_long, summary_short").in("id", chunk);
    if (error) throw error;
    (data ?? []).forEach((r) => summaries.set(r.id, r.summary_long || r.summary_short || ""));
    for (let from = 0; ; from += 1000) {
      const { data: lp, error: e2 } = await supabase
        .from("letter_people")
        .select("letter_id, role, people(name)")
        .in("letter_id", chunk)
        .order("letter_id")
        .range(from, from + 999);
      if (e2) throw e2;
      (lp ?? []).forEach((r) => {
        const name = r.people?.name;
        if (!name || r.role === "author" || r.role === "recipient") return;
        if (!people.has(r.letter_id)) people.set(r.letter_id, new Set());
        people.get(r.letter_id)!.add(name);
      });
      if (!lp || lp.length < 1000) break;
    }
  }
  return sortExportRows(
    letters.map((l) => ({
      date: displayDate(l) || "Undated",
      sortDate: l.normalized_date,
      archiveId: l.archive_id,
      title: l.title ?? "",
      from: l.author || "Unknown",
      to: l.recipient || "Unknown",
      origin: l.origin || "Not recorded",
      destination: l.destination || "Not recorded",
      summary: summaries.get(l.id) || "No summary yet.",
      people: [...(people.get(l.id) ?? [])].sort(),
    })),
  );
}

// Standard PDF fonts only cover Latin-1; swap common typographic characters.
const pdfSafe = (s: string) =>
  s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/\u00B7/g, "-").replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");

async function buildPdf(rows: SummaryExportRow[], heading: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;
  const ensure = (h: number) => {
    if (y + h > bottom) {
      doc.addPage();
      y = margin;
    }
  };
  const write = (text: string, size: number, style: "normal" | "bold", gap = 2) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(pdfSafe(text), width) as string[];
    const lh = size * 1.35;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, margin, y + size);
      y += lh;
    }
    y += gap;
  };
  write(heading, 18, "bold", 4);
  write(`${rows.length} records, in date order.`, 10, "normal", 14);
  for (const r of rows) {
    ensure(80);
    write(`${r.archiveId}${r.title ? ` - ${r.title}` : ""}`, 13, "bold", 3);
    for (const [k, v] of recordFields(r)) write(`${k}: ${v}`, 10, "normal", 0);
    y += 4;
    write(`Summary: ${r.summary}`, 10.5, "normal", 8);
    ensure(14);
    doc.setDrawColor(180);
    doc.line(margin, y, margin + width, y);
    y += 12;
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${pdfSafe(heading)} - page ${p} of ${pages}`, margin, bottom + 24);
  }
  return doc.output("blob");
}

export function TimelineSummaryExport({ visible, selected }: { visible: Letter[]; selected: Letter[] }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"selected" | "visible">("visible");
  const [busy, setBusy] = useState<Format | null>(null);
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null);
  const useSelected = scope === "selected" && selected.length > 0;
  const chosen = useSelected ? selected : visible;

  const generate = async (format: Format) => {
    setBusy(format);
    setReady(null);
    try {
      const rows = await loadRows(chosen);
      const heading = "The Francis Files - Timeline Summary";
      const stamp = new Date().toISOString().slice(0, 10);
      const base = `Timeline Summary ${stamp}`;
      let blob: Blob;
      if (format === "csv") blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
      else if (format === "doc") blob = new Blob(["\uFEFF" + buildDocHtml(rows, heading)], { type: "application/msword" });
      else blob = await buildPdf(rows, heading);
      setReady({ blob, name: `${base}.${format}` });
    } catch (e) {
      toast.error((e as Error).message || "Could not build the report");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReady(null); if (o) setScope(selected.length ? "selected" : "visible"); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileDown className="size-4" /> Timeline Summary Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Timeline Summary Export</DialogTitle>
          <DialogDescription>
            Date, record number, From, To, mailing origin and destination, long summary and people mentioned for each record, in date order.
          </DialogDescription>
        </DialogHeader>
        {selected.length > 0 && (
          <div className="flex gap-2" role="radiogroup" aria-label="Which records">
            <Button size="sm" variant={scope === "selected" ? "default" : "outline"} onClick={() => { setScope("selected"); setReady(null); }}>
              Selected ({selected.length})
            </Button>
            <Button size="sm" variant={scope === "visible" ? "default" : "outline"} onClick={() => { setScope("visible"); setReady(null); }}>
              All shown ({visible.length})
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{chosen.length} records will be included.</p>
        <div className="grid grid-cols-3 gap-2">
          {(["pdf", "doc", "csv"] as Format[]).map((f) => (
            <Button key={f} variant="outline" disabled={!!busy || chosen.length === 0} onClick={() => generate(f)}>
              {busy === f ? "Building…" : f.toUpperCase()}
            </Button>
          ))}
        </div>
        {ready && (
          <Button className="gap-2" onClick={() => downloadBlob(ready.blob, ready.name)}>
            <FileDown className="size-4" /> Download {ready.name}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
