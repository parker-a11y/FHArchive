import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Boxes, ExternalLink, FolderInput, Layers, LayoutGrid, ListChecks, Loader2, RotateCcw, RotateCw, Search, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rotatePhotoView, type Photo } from "@/lib/photos";
import { assignBox, assignSleeve, createBox, createSleeve, deleteSleeve, fetchBatches, moveSleeves, renameSleeve, setCategory } from "@/lib/photo-catalog";
import { applySelectionClick, nextBoxCode, nextSleeveCode, sleeveLabel } from "@/lib/photo-archive";
import { SignedImg } from "@/components/photos/SignedImg";
import { usePhotoData } from "@/components/photos/usePhotoData";
import { EmailPhotosButton } from "@/components/photos/EmailPhotosButton";
import { SleeveLabelButton } from "@/components/photos/SleeveLabelButton";
import { PhotoGrid, type Density } from "@/components/photos/PhotoGrid";
import { PhotoLightbox } from "@/components/photos/PhotoLightbox";
import { photoRecordRef, usePhotoRecords, type PhotoRecordRef } from "@/lib/photo-links";

type Sort = "ph" | "ph-desc" | "uploaded" | "caption";
type View = "list" | "grid";

const VIEW_KEY = "photo_record_view";
const DENSITY_KEY = "photo_record_density";

/** Remembered between visits; defaults to the table. */
function readStored<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v as T) ? (v as T) : null;
  } catch {
    return null;
  }
}

export function PhotoRecordList() {
  const d = usePhotoData();
  const navigate = useNavigate();
  /** Double-click opens the photograph's own record in the Organizer tab. */
  const openPhoto = (id: string) => void navigate({ to: "/photo-organizer", search: { photo: id } });
  const batches = useQuery({ queryKey: ["photo-batches"], queryFn: fetchBatches });
  const records = usePhotoRecords();
  const recs: Map<string, PhotoRecordRef> = records.data ?? new Map();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [box, setBox] = useState("");
  const [batch, setBatch] = useState("");
  const [sort, setSort] = useState<Sort>("ph");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const [sleeveOpen, setSleeveOpen] = useState(false);
  const [sleeve, setSleeve] = useState("");
  const [view, setView] = useState<View>("list");
  const [density, setDensity] = useState<Density>("md");
  const [zoomId, setZoomId] = useState<string | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const [rotating, setRotating] = useState<Set<string>>(new Set());

  const rotate = async (p: Photo, degrees: 90 | -90) => {
    if (rotating.has(p.id)) return;
    setRotating((s) => new Set(s).add(p.id));
    try {
      const patch = await rotatePhotoView(p, degrees);
      d.patch((old) => ({ ...old, photos: old.photos.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
      toast.success(`Rotation saved for ${p.ph_id ?? "photograph"}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setRotating((s) => { const n = new Set(s); n.delete(p.id); return n; }); }
  };

  // Read the remembered view after mount, so the server render and the first
  // paint always agree. Nothing is written back until the read has landed,
  // otherwise the first paint would overwrite the stored choice.
  useEffect(() => {
    setView(readStored(VIEW_KEY, ["list", "grid"] as const) ?? "list");
    setDensity(readStored(DENSITY_KEY, ["sm", "md", "lg"] as const) ?? "md");
    setViewReady(true);
  }, []);
  useEffect(() => {
    if (!viewReady) return;
    try {
      localStorage.setItem(VIEW_KEY, view);
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* storage unavailable — the view just isn't remembered */
    }
  }, [view, density, viewReady]);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const r = d.photos.filter((p) => {
      const cats = d.byPhoto.get(p.id) ?? [];
      if (cat === "__none" ? cats.length > 0 : cat && !cats.includes(cat)) return false;
      if (box === "__none" ? !!p.box_id : box && p.box_id !== box) return false;
      if (batch && p.batch_id !== batch) return false;
      if (sleeve === "__none" ? !!p.sleeve_id : sleeve && p.sleeve_id !== sleeve) return false;
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
  }, [d.photos, d.byPhoto, d.catName, q, cat, box, batch, sleeve, sort]);
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

  const leaveSleeve = async () => {
    setBusy(true);
    try { await assignSleeve(selected, null); toast.success("Removed from sleeve (box unchanged)"); d.refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <SleevesPanel />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search photographs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PH, FH, subtitle, people…" className="pl-8" />
        </div>
        <Select label="Category" value={cat} onChange={setCat} options={[["", "All categories"], ["__none", "Uncategorized"], ...d.categories.map((c) => [c.id, c.name] as [string, string])]} />
        <Select label="Box" value={box} onChange={setBox} options={[["", "All boxes"], ["__none", "No box"], ...d.boxes.map((b) => [b.id, b.code] as [string, string])]} />
        <Select label="Batch" value={batch} onChange={setBatch} options={[["", "All batches"], ...(batches.data ?? []).map((b) => [b.id, b.name || new Date(b.created_at).toLocaleDateString()] as [string, string])]} />
        <Select label="Sleeve" value={sleeve} onChange={setSleeve} options={[["", "All sleeves"], ["__none", "No sleeve"], ...d.sleeves.map((x) => [x.id, x.code.replace("-", " ")] as [string, string])]} />
        <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={[["ph", "PH number"], ["ph-desc", "PH number, newest"], ["uploaded", "Upload date"], ["caption", "Subtitle"]]} />
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5" role="group" aria-label="Record list view">
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} aria-pressed={view === "list"} onClick={() => setView("list")}><ListChecks className="mr-1 size-4" />List</Button>
          <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid className="mr-1 size-4" />Grid</Button>
        </div>
        {view === "grid" && <Select label="Thumbnail size" value={density} onChange={(v) => setDensity(v as Density)} options={[["sm", "Small thumbnails"], ["md", "Medium thumbnails"], ["lg", "Large thumbnails"]]} />}
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
          <EmailPhotosButton photos={rows.filter((p) => sel.has(p.id)).concat(d.photos.filter((p) => sel.has(p.id) && !rows.includes(p)))} label={`Email ${sel.size}`} />
          <Button size="sm" disabled={busy} onClick={() => setSleeveOpen(true)}><Layers className="mr-1 size-4" />Add to Sleeve</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void leaveSleeve()}>Remove from sleeve</Button>
          {busy && <Loader2 className="size-4 animate-spin" />}
        </>}
      </div>

      {view === "grid" ? (
        <PhotoGrid
          rows={rows}
          sel={sel}
          onPick={click}
          catNames={(p) => (d.byPhoto.get(p.id) ?? []).map((c) => d.catName.get(c) ?? "").filter(Boolean)}
          sleeveOf={(p) => (p.sleeve_id && d.sleeveById.get(p.sleeve_id)?.code.replace("-", " ")) || null}
          boxOf={(p) => (p.box_id ? d.boxById.get(p.box_id)?.code ?? null : null)}
          recOf={(p) => photoRecordRef(p, recs)}
          onZoom={setZoomId}
          onOpen={openPhoto}
          onRotate={(p, deg) => void rotate(p, deg)}
          rotating={rotating}
          density={density}
        />
      ) : (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr><th className="w-10 px-2 py-2" /><th className="w-16 px-2 py-2">Photo</th><th className="w-16 px-2 py-2">Rotate</th><th className="w-28 px-2 py-2">PH</th><th className="px-2 py-2">Subtitle</th><th className="px-2 py-2">Categories</th><th className="w-28 px-2 py-2">Uploaded</th><th className="w-28 px-2 py-2">Sleeve</th><th className="w-28 px-2 py-2">Box</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const on = sel.has(p.id);
              const b = p.box_id ? d.boxById.get(p.box_id) : null;
              const rec = photoRecordRef(p, recs);
              return (
                <tr key={p.id} className={`cursor-pointer border-t border-border/60 select-none ${on ? "bg-accent/60" : "hover:bg-muted/40"}`}
                  onClick={(e) => click(p.id, e.shiftKey)}>
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={`Select ${p.ph_id ?? "photograph"}`} checked={on} onClick={(e) => { e.preventDefault(); click(p.id, e.shiftKey); }} />
                  </td>
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}
                    title="Double-click to open this photograph's record"
                    onDoubleClick={(e) => { e.stopPropagation(); openPhoto(p.id); }}>
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-muted"><SignedImg path={p.front_thumb_path ?? p.front_view_path} alt="" className="max-h-12 max-w-12 object-contain" /></div>
                  </td>
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    {rotating.has(p.id) ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving rotation" />
                    ) : (
                      <div className="flex gap-0.5">
                        <Button size="icon" variant="ghost" className="size-7" aria-label={`Rotate ${p.ph_id ?? "photograph"} left and save`} title="Rotate left 90° and save" onClick={() => void rotate(p, -90)}><RotateCcw className="size-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="size-7" aria-label={`Rotate ${p.ph_id ?? "photograph"} right and save`} title="Rotate right 90° and save" onClick={() => void rotate(p, 90)}><RotateCw className="size-3.5" /></Button>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-xs">
                    <span onClick={(e) => e.stopPropagation()}>{p.ph_id ?? "—"}</span>
                    {rec && (
                      <a href={rec.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        title={`Open the ${rec.archive_id} record`}
                        className="mt-0.5 flex w-fit items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                        {rec.archive_id}<ExternalLink className="size-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-2 py-1.5">{p.caption || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{(d.byPhoto.get(p.id) ?? []).map((c) => d.catName.get(c)).join(", ") || "—"}</td>
                  <td className="px-2 py-1.5 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{(p.sleeve_id && d.sleeveById.get(p.sleeve_id)?.code.replace("-", " ")) || "—"}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{b?.code ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
      <p className="text-xs text-muted-foreground">{view === "grid"
        ? "Click a tile to select it (Shift-click for a range), double-click to open the photograph's record, or hover for the full-size and rotate buttons. Rotating saves permanently."
        : "Click anywhere in a row (except its photo) or use the checkbox to select; Shift-click selects a continuous range. Double-click a photo to open its record; use the FH number to open the linked archive record in a new tab. The rotate buttons save permanently."}</p>
      <AssignBoxDialog open={boxOpen} onOpenChange={setBoxOpen} ids={selected} onDone={() => d.refresh()} />
      <AddToSleeveDialog open={sleeveOpen} onOpenChange={setSleeveOpen} ids={selected} onDone={() => d.refresh()} />
      {zoomId && (
        <PhotoLightbox
          photos={rows}
          index={Math.max(0, rows.findIndex((p) => p.id === zoomId))}
          canDownloadOriginal
          categoryNames={(p) => (d.byPhoto.get(p.id) ?? []).map((id) => d.catName.get(id) ?? "")}
          boxLabel={(p) => (p.box_id ? d.boxById.get(p.box_id)?.code ?? null : null)}
          onIndex={(i) => setZoomId(rows[i]?.id ?? null)}
          onClose={() => setZoomId(null)}
        />
      )}
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

function AssignBoxDialog({ open, onOpenChange, ids, sleeveIds = [], onDone }: { open: boolean; onOpenChange: (o: boolean) => void; ids: string[]; sleeveIds?: string[]; onDone: () => void }) {
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
      if (ids.length) await assignBox(ids, boxId);
      await moveSleeves(sleeveIds, boxId);
      toast.success(`${[ids.length && `${ids.length} photographs`, sleeveIds.length && `${sleeveIds.length} sleeve${sleeveIds.length === 1 ? "" : "s"}`].filter(Boolean).join(" and ")} assigned to ${label}`);
      onDone(); onOpenChange(false);
      setCode(""); setName(""); setLoc(""); setChoice("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign {sleeveIds.length ? `${sleeveIds.length} sleeve${sleeveIds.length === 1 ? "" : "s"}` : `${ids.length} photographs`} to a box</DialogTitle></DialogHeader>
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

function AddToSleeveDialog({ open, onOpenChange, ids, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; ids: string[]; onDone: () => void }) {
  const d = usePhotoData();
  const [choice, setChoice] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = choice === "__new" || d.sleeves.length === 0;
  const next = nextSleeveCode(d.sleeves.map((x) => x.code));
  const apply = async () => {
    setBusy(true);
    try {
      let id = choice;
      let label = d.sleeves.find((x) => x.id === choice)?.code;
      if (isNew) { const x = await createSleeve({ code: next, name }); id = x.id; label = x.code; }
      if (!id) return;
      await assignSleeve(ids, id);
      toast.success(`${ids.length} photographs added to ${label?.replace("-", " ")}`);
      onDone(); onOpenChange(false); setChoice(""); setName("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add {ids.length} photographs to a sleeve</DialogTitle></DialogHeader>
        <select aria-label="Sleeve" value={isNew ? "__new" : choice} onChange={(e) => setChoice(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
          <option value="">Choose a sleeve…</option>
          {d.sleeves.map((x) => <option key={x.id} value={x.id}>{sleeveLabel(x)}{x.box_id ? ` (in ${d.boxById.get(x.box_id)?.code ?? "box"})` : ""}</option>)}
          <option value="__new">+ New sleeve ({next.replace("-", " ")})</option>
        </select>
        {isNew && <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional name, e.g. Skip at Ft Schuyler" aria-label="Sleeve name" />}
        <p className="text-xs text-muted-foreground">Photographs take on the sleeve’s box. A new sleeve starts unassigned — move it into a box from the Sleeves list above.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy || (!isNew && !choice)} onClick={() => void apply()}>{busy && <Loader2 className="mr-1 size-4 animate-spin" />}Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sleeves list: unassigned sleeves show by default; sleeves already boxed are one click away so they can still be moved. */
function SleevesPanel() {
  const d = usePhotoData();
  const [showBoxed, setShowBoxed] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [boxOpen, setBoxOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of d.photos) if (p.sleeve_id) m.set(p.sleeve_id, (m.get(p.sleeve_id) ?? 0) + 1);
    return m;
  }, [d.photos]);
  const loose = d.sleeves.filter((x) => !x.box_id);
  const shown = showBoxed ? d.sleeves : loose;
  const boxedCount = d.sleeves.length - loose.length;
  if (!d.sleeves.length) return null;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true);
    try { await fn(); toast.success(msg); d.refresh(); setSel(new Set()); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-md border border-border bg-card p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="size-4 text-muted-foreground" />
        <span className="font-medium">Sleeves</span>
        <span className="text-xs text-muted-foreground">{loose.length} not in a box{boxedCount ? ` · ${boxedCount} boxed` : ""}</span>
        {boxedCount > 0 && <Button size="sm" variant="ghost" onClick={() => setShowBoxed((v) => !v)}>{showBoxed ? "Hide boxed sleeves" : "Show boxed sleeves"}</Button>}
        {sel.size > 0 && <>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" disabled={busy} onClick={() => setBoxOpen(true)}><FolderInput className="mr-1 size-4" />Move {sel.size} to Box</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => moveSleeves([...sel], null), "Sleeves taken out of their box")}>Take out of box</Button>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}><X className="mr-1 size-3.5" />Clear</Button>
        </>}
      </div>
      {shown.length > 0 && (
        <ul className="mt-2 divide-y divide-border/60">
          {shown.map((x) => {
            const box = x.box_id ? d.boxById.get(x.box_id) : null;
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <Checkbox aria-label={`Select ${x.code}`} checked={sel.has(x.id)} onCheckedChange={() => toggle(x.id)} />
                <span className="font-mono text-xs">{sleeveLabel({ ...x, name: null })}</span>
                <Input className="h-7 max-w-[14rem] text-xs" defaultValue={x.name ?? ""} placeholder="Optional name" aria-label={`${x.code} name`}
                  onBlur={(e) => e.target.value !== (x.name ?? "") && void renameSleeve(x.id, e.target.value).then(d.refresh)} />
                <span className="text-xs text-muted-foreground">{counts.get(x.id) ?? 0} photographs · {box ? box.code : "No box"}</span>
                <select aria-label={`Move ${x.code} to box`} disabled={busy} value={x.box_id ?? ""} onChange={(e) => void run(() => moveSleeves([x.id], e.target.value || null), `${x.code.replace("-", " ")} moved`)}
                  className="ml-auto rounded-md border border-input bg-background px-2 py-1 text-xs">
                  <option value="">No box</option>
                  {d.boxes.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
                </select>
                <SleeveLabelButton sleeve={x} boxCode={box?.code} phIds={d.photos.filter((p) => p.sleeve_id === x.id && p.ph_id).sort((a, b) => (a.ph_seq ?? 0) - (b.ph_seq ?? 0)).map((p) => p.ph_id!)} />
                <Button size="icon" variant="ghost" className="size-7" aria-label={`Delete ${x.code}`} disabled={busy}
                  onClick={() => confirm(`Delete ${x.code}? Its photographs stay in their box, unsleeved.`) && void run(() => deleteSleeve(x.id), "Sleeve deleted")}><Trash2 className="size-3.5" /></Button>
              </li>
            );
          })}
        </ul>
      )}
      <AssignBoxDialog open={boxOpen} onOpenChange={setBoxOpen} ids={[]} sleeveIds={[...sel]} onDone={() => { d.refresh(); setSel(new Set()); }} />
    </div>
  );
}
