import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, Loader2, Search, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Photo } from "@/lib/photos";
import { assignBox, createBox, fetchBatches, setCategory } from "@/lib/photo-catalog";
import { applySelectionClick, nextBoxCode } from "@/lib/photo-archive";
import { SignedImg } from "@/components/photos/SignedImg";
import { usePhotoData } from "@/components/photos/usePhotoData";

type Sort = "ph" | "ph-desc" | "uploaded" | "caption";

export function PhotoRecordList() {
  const d = usePhotoData();
  const batches = useQuery({ queryKey: ["photo-batches"], queryFn: fetchBatches });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [box, setBox] = useState("");
  const [batch, setBatch] = useState("");
  const [sort, setSort] = useState<Sort>("ph");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const r = d.photos.filter((p) => {
      const cats = d.byPhoto.get(p.id) ?? [];
      if (cat === "__none" ? cats.length > 0 : cat && !cats.includes(cat)) return false;
      if (box === "__none" ? !!p.box_id : box && p.box_id !== box) return false;
      if (batch && p.batch_id !== batch) return false;
      if (!n) return true;
      return [p.ph_id, p.legacy_archive_id, p.caption, p.people, p.date_text, p.location, p.inscription, p.notes, p.original_filename, ...cats.map((c) => d.catName.get(c))]
        .filter(Boolean).join(" ").toLowerCase().includes(n);
    });
    const cmp: Record<Sort, (a: Photo, b: Photo) => number> = {
      ph: (a, b) => (a.ph_seq ?? 1e9) - (b.ph_seq ?? 1e9),
      "ph-desc": (a, b) => (b.ph_seq ?? -1) - (a.ph_seq ?? -1),
      uploaded: (a, b) => b.created_at.localeCompare(a.created_at),
      caption: (a, b) => (a.caption ?? "\uffff").localeCompare(b.caption ?? "\uffff"),
    };
    return r.sort(cmp[sort]);
  }, [d.photos, d.byPhoto, d.catName, q, cat, box, batch, sort]);
  const ids = rows.map((r) => r.id);
  const selected = [...sel];

  const click = (id: string, shift: boolean) => {
    setSel((s) => applySelectionClick(ids, s, anchor.current, id, shift));
    anchor.current = id;
  };

  const bulkCategory = async (catId: string, on: boolean) => {
    if (!catId || !selected.length) return;
    setBusy(true);
    try {
      await setCategory(selected, catId, on);
      toast.success(`${on ? "Added" : "Removed"} “${d.catName.get(catId)}” ${on ? "to" : "from"} ${selected.length} photographs`);
      d.refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const clearBox = async () => {
    if (!confirm(`Clear the storage box for ${selected.length} photographs?`)) return;
    setBusy(true);
    try { await assignBox(selected, null); toast.success("Storage box cleared"); d.refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search photographs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PH, FH, subtitle, people…" className="pl-8" />
        </div>
        <Select label="Category" value={cat} onChange={setCat} options={[["", "All categories"], ["__none", "Uncategorized"], ...d.categories.map((c) => [c.id, c.name] as [string, string])]} />
        <Select label="Box" value={box} onChange={setBox} options={[["", "All boxes"], ["__none", "No box"], ...d.boxes.map((b) => [b.id, b.code] as [string, string])]} />
        <Select label="Batch" value={batch} onChange={setBatch} options={[["", "All batches"], ...(batches.data ?? []).map((b) => [b.id, b.name || new Date(b.created_at).toLocaleDateString()] as [string, string])]} />
        <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={[["ph", "PH number"], ["ph-desc", "PH number, newest"], ["uploaded", "Upload date"], ["caption", "Subtitle"]]} />
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
        <span className="px-1 font-medium">{sel.size ? `${sel.size} photograph${sel.size === 1 ? "" : "s"} selected` : `${rows.length} photographs`}</span>
        <Button size="sm" variant="ghost" onClick={() => setSel(new Set([...sel, ...ids]))}>Select all {rows.length}</Button>
        {sel.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}><X className="mr-1 size-3.5" />Clear selection</Button>}
        {sel.size > 0 && <>
          <span className="mx-1 h-5 w-px bg-border" />
          <Tag className="size-4 text-muted-foreground" />
          <select aria-label="Add category to selected" disabled={busy} value="" onChange={(e) => void bulkCategory(e.target.value, true)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">Add category…</option>{d.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Remove category from selected" disabled={busy} value="" onChange={(e) => void bulkCategory(e.target.value, false)} className="rounded-md border border-input bg-background px-2 py-1">
            <option value="">Remove category…</option>{d.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button size="sm" disabled={busy} onClick={() => setBoxOpen(true)}><Boxes className="mr-1 size-4" />Assign to Box</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void clearBox()}>Clear box</Button>
          {busy && <Loader2 className="size-4 animate-spin" />}
        </>}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr><th className="w-10 px-2 py-2" /><th className="w-16 px-2 py-2">Photo</th><th className="w-28 px-2 py-2">PH</th><th className="px-2 py-2">Subtitle</th><th className="px-2 py-2">Categories</th><th className="w-28 px-2 py-2">Uploaded</th><th className="w-28 px-2 py-2">Box</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const on = sel.has(p.id);
              const b = p.box_id ? d.boxById.get(p.box_id) : null;
              return (
                <tr key={p.id} className={`cursor-pointer border-t border-border/60 select-none ${on ? "bg-accent/60" : "hover:bg-muted/40"}`}
                  onClick={(e) => click(p.id, e.shiftKey)}>
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={`Select ${p.ph_id ?? "photograph"}`} checked={on} onClick={(e) => { e.preventDefault(); click(p.id, e.shiftKey); }} />
                  </td>
                  <td className="px-2 py-1.5"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-muted"><SignedImg path={p.front_thumb_path ?? p.front_view_path} alt="" className="max-h-12 max-w-12 object-contain" /></div></td>
                  <td className="px-2 py-1.5 font-mono text-xs">{p.ph_id ?? "—"}{p.legacy_archive_id && <div className="text-[10px] text-muted-foreground">{p.legacy_archive_id}</div>}</td>
                  <td className="px-2 py-1.5">{p.caption || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{(d.byPhoto.get(p.id) ?? []).map((c) => d.catName.get(c)).join(", ") || "—"}</td>
                  <td className="px-2 py-1.5 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{b?.code ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Click a row or checkbox to select; Shift-click selects a continuous range.</p>
      <AssignBoxDialog open={boxOpen} onOpenChange={setBoxOpen} ids={selected} onDone={() => d.refresh()} />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-input bg-background px-2 py-2 text-sm">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function AssignBoxDialog({ open, onOpenChange, ids, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; ids: string[]; onDone: () => void }) {
  const d = usePhotoData();
  const [choice, setChoice] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = choice === "__new" || d.boxes.length === 0;
  const apply = async () => {
    setBusy(true);
    try {
      let boxId = choice;
      let label = d.boxes.find((b) => b.id === choice)?.code;
      if (isNew) { const b = await createBox({ code: code || nextBoxCode(d.boxes.map((x) => x.code)), name, location: loc }); boxId = b.id; label = b.code; }
      if (!boxId) return;
      await assignBox(ids, boxId);
      toast.success(`${ids.length} photographs assigned to ${label}`);
      onDone(); onOpenChange(false);
      setCode(""); setName(""); setLoc(""); setChoice("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign {ids.length} photographs to a box</DialogTitle></DialogHeader>
        <select aria-label="Storage box" value={isNew ? "__new" : choice} onChange={(e) => setChoice(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
          <option value="">Choose a box…</option>
          {d.boxes.map((b) => <option key={b.id} value={b.id}>{b.code}{b.name ? ` — ${b.name}` : ""}</option>)}
          <option value="__new">+ New photo box</option>
        </select>
        {isNew && (
          <div className="space-y-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={nextBoxCode(d.boxes.map((b) => b.code))} aria-label="Box identifier" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional name, e.g. Harrington Family Photographs" aria-label="Box name" />
            <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Optional location, e.g. Archive Closet — Shelf 2" aria-label="Box location" />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || (!isNew && !choice)} onClick={() => void apply()}>{busy && <Loader2 className="mr-1 size-4 animate-spin" />}Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
