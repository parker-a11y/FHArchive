import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Images, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { condenseRanges } from "@/lib/box-ranges";
import { createBox, fetchBoxes, updateBox, type PhotoBox } from "@/lib/photo-catalog";
import { nextBoxCode } from "@/lib/photo-archive";

type Row = { id: string; ph_id: string | null; ph_seq: number | null; caption: string | null; box_id: string | null };

async function fetchBoxedPhotos(): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("photos").select("id, ph_id, ph_seq, caption, box_id").not("box_id", "is", null).order("ph_seq").order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function printLabel(box: PhotoBox, rows: Row[]) {
  const w = window.open("", "_blank", "width=480,height=720");
  if (!w) { toast.error("Allow pop-ups to print the label"); return; }
  const range = condenseRanges(rows.map((r) => r.ph_id).filter(Boolean) as string[]);
  w.document.write(`<!doctype html><title>${esc(box.code)}</title><style>
    @page{size:4in 6in;margin:0}body{margin:0;font-family:Georgia,serif;color:#222}
    .l{box-sizing:border-box;width:4in;height:6in;padding:.4in .35in;display:flex;flex-direction:column;justify-content:space-between;text-align:center;border:1px solid #ccc}
    .k{font:600 10px/1 sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#777}.c{font-size:40px;font-weight:600;margin:.15in 0}
    .n{font-size:18px;font-style:italic}.r{font:11px/1.4 monospace;word-break:break-word}.s{font-size:13px}</style>
    <div class="l"><div><div class="k">The Francis Files · Photographs</div><div class="c">${esc(box.code)}</div>${box.name ? `<div class="n">${esc(box.name)}</div>` : ""}</div>
    <div class="r">${esc(range || "Empty")}</div>
    <div class="s">${rows.length} photograph${rows.length === 1 ? "" : "s"}${box.location ? `<br>${esc(box.location)}` : ""}</div></div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>`);
  w.document.close();
}

/** Photo storage boxes (PHOTO-###), listed alongside — but separately from — the FH letter boxes. */
export function PhotoBoxesSection({ search }: { search: string }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const boxes = useQuery({ queryKey: ["photo-boxes"], queryFn: fetchBoxes });
  const photos = useQuery({ queryKey: ["photo-box-contents"], queryFn: fetchBoxedPhotos });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const byBox = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const p of photos.data ?? []) if (p.box_id) m.set(p.box_id, [...(m.get(p.box_id) ?? []), p]);
    return m;
  }, [photos.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["photo-boxes"] }); qc.invalidateQueries({ queryKey: ["photo-gallery"] }); };
  const needle = search.trim().toLowerCase();
  const list = (boxes.data ?? []).filter((b) => !needle || [b.code, b.name, b.location].some((v) => v?.toLowerCase().includes(needle)) || (byBox.get(b.id) ?? []).some((r) => r.ph_id?.toLowerCase().includes(needle) || r.caption?.toLowerCase().includes(needle)));

  return (
    <section className="px-4 pb-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
        <h2 className="font-display text-2xl">Photo Boxes</h2>
        {isAdmin && <Button size="sm" variant="outline" onClick={async () => {
          try { await createBox({ code: nextBoxCode((boxes.data ?? []).map((b) => b.code)) }); refresh(); } catch (e) { toast.error((e as Error).message); }
        }}><Plus className="mr-1 size-4" />New photo box</Button>}
      </div>
      {boxes.isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading photo boxes…</p> : list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{needle ? "No photo boxes match." : "No photo boxes yet. Assign photographs to a box from the Photo Organizer’s Record List."}</p>
      ) : list.map((b) => {
        const rows = byBox.get(b.id) ?? [];
        const isOpen = open.has(b.id) || !!needle;
        return (
          <div key={b.id} className="border-b border-border">
            <Button variant="ghost" aria-expanded={isOpen} className="h-auto w-full justify-start gap-3 rounded-none px-0 py-4 text-left whitespace-normal hover:bg-muted/40"
              onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })}>
              <Images className="size-5 shrink-0 text-archive-gold" />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold">{b.code}{b.name && <span className="font-normal"> — {b.name}</span>}</span>
                <span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{[b.location, condenseRanges(rows.map((r) => r.ph_id).filter(Boolean) as string[])].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">{rows.length} photograph{rows.length === 1 ? "" : "s"}</span>
              <ChevronDown className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </Button>
            {isOpen && (
              <div className="space-y-3 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && <>
                    <Input className="max-w-xs" defaultValue={b.name ?? ""} placeholder="Optional name" aria-label={`${b.code} name`} onBlur={(e) => e.target.value !== (b.name ?? "") && void updateBox(b.id, { name: e.target.value, location: b.location ?? "" }).then(refresh)} />
                    <Input className="max-w-xs" defaultValue={b.location ?? ""} placeholder="Optional shelf or cabinet" aria-label={`${b.code} location`} onBlur={(e) => e.target.value !== (b.location ?? "") && void updateBox(b.id, { name: b.name ?? "", location: e.target.value }).then(refresh)} />
                  </>}
                  <Button size="sm" variant="outline" onClick={() => printLabel(b, rows)}><Printer className="mr-1 size-4" />Print label</Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rows.map((r) => (
                    <Link key={r.id} to="/photos" search={{ photo: r.ph_id ?? r.id }} title={r.caption ?? undefined}
                      className="rounded border border-border px-2 py-0.5 font-mono text-xs hover:border-primary hover:text-primary">{r.ph_id ?? "Unnumbered"}</Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
