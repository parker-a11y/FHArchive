import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ImagePlus, Loader2, Maximize2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { attachPhotoBack, deletePhoto, viewPath, type Photo } from "@/lib/photos";
import { assignBox, createCategory, fetchBatches, savePhotoDetails, setCategory, type PhotoDetails } from "@/lib/photo-catalog";
import { SignedImg } from "@/components/photos/SignedImg";
import { PhotoLightbox } from "@/components/photos/PhotoLightbox";
import { usePhotoData } from "@/components/photos/usePhotoData";

type SetKind = "uncategorized" | "all" | "recent" | `batch:${string}` | `cat:${string}`;
const RECENT_DAYS = 30;

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function PhotoOrganizer() {
  const d = usePhotoData();
  const batches = useQuery({ queryKey: ["photo-batches"], queryFn: fetchBatches });
  const [kind, setKind] = useState<SetKind>("uncategorized");
  // The working set is frozen when chosen, so categorizing never pulls the current photo out of view.
  const [ids, setIds] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  const build = (k: SetKind) => {
    const cutoff = Date.now() - RECENT_DAYS * 864e5;
    return d.photos.filter((p) => {
      const cats = d.byPhoto.get(p.id) ?? [];
      if (k === "uncategorized") return cats.length === 0;
      if (k === "recent") return new Date(p.created_at).getTime() >= cutoff;
      if (k.startsWith("batch:")) return p.batch_id === k.slice(6);
      if (k.startsWith("cat:")) return cats.includes(k.slice(4));
      return true;
    }).sort((a, b) => (a.ph_seq ?? 1e9) - (b.ph_seq ?? 1e9) || a.created_at.localeCompare(b.created_at)).map((p) => p.id);
  };
  const choose = (k: SetKind) => { setKind(k); setIds(build(k)); setPos(0); };
  const first = useRef(true);
  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    const u = build("uncategorized");
    if (u.length) setIds(u); else { setKind("all"); setIds(build("all")); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map(d.photos.map((p) => [p.id, p])), [d.photos]);
  const list = ids.map((id) => byId.get(id)).filter(Boolean) as Photo[];
  const photo = list[Math.min(pos, list.length - 1)];
  const mine = photo ? d.byPhoto.get(photo.id) ?? [] : [];

  const toggle = async (catId: string) => {
    if (!photo) return;
    const on = !mine.includes(catId);
    d.patchLinks((links) => on ? [...links, { photo_id: photo.id, category_id: catId }] : links.filter((l) => !(l.photo_id === photo.id && l.category_id === catId)));
    try { await setCategory([photo.id], catId, on); }
    catch (e) { toast.error((e as Error).message); d.refresh(); }
  };

  const go = (delta: number) => setPos((p) => Math.max(0, Math.min(list.length - 1, p + delta)));
  const toggleRef = useRef(toggle); toggleRef.current = toggle;
  const goRef = useRef(go); goRef.current = go;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (zoomOpen || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goRef.current(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goRef.current(-1); }
      else if (/^[1-9]$/.test(e.key)) {
        const c = d.categories[Number(e.key) - 1];
        if (c) { e.preventDefault(); void toggleRef.current(c.id); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOpen, d.categories]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-muted-foreground" htmlFor="org-set">Working set</label>
        <select id="org-set" value={kind} onChange={(e) => choose(e.target.value as SetKind)} className="rounded-md border border-input bg-background px-2 py-1.5">
          <option value="uncategorized">Uncategorized</option>
          <option value="all">All photographs</option>
          <option value="recent">Recently uploaded (30 days)</option>
          {(batches.data ?? []).length > 0 && <optgroup label="Upload batch">{batches.data!.map((b) => <option key={b.id} value={`batch:${b.id}`}>{b.name || `Batch of ${new Date(b.created_at).toLocaleDateString()}`}</option>)}</optgroup>}
          {d.categories.length > 0 && <optgroup label="Category">{d.categories.map((c) => <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>)}</optgroup>}
        </select>
        <Button size="sm" variant="ghost" onClick={() => choose(kind)}>Refresh set</Button>
        <span className="text-muted-foreground">{list.length ? `${Math.min(pos, list.length - 1) + 1} of ${list.length}` : "Nothing in this set"}</span>
      </div>

      {!photo ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {kind === "uncategorized" ? "Every photograph has at least one category. Choose another working set to keep going." : "No photographs in this working set."}
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-sm tracking-widest">{photo.ph_id ?? "Unnumbered"}{photo.legacy_archive_id && <span className="ml-2 text-xs text-muted-foreground">formerly {photo.legacy_archive_id}</span>}</p>
                {photo.caption && <p className="truncate font-display text-lg">{photo.caption}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="outline" aria-label="Previous photograph" disabled={pos === 0} onClick={() => go(-1)}><ChevronLeft /></Button>
                <Button size="icon" variant="outline" aria-label="Next photograph" disabled={pos >= list.length - 1} onClick={() => go(1)}><ChevronRight /></Button>
                <Button size="icon" variant="outline" aria-label="Zoom" onClick={() => setZoomOpen(true)}><Maximize2 /></Button>
              </div>
            </div>
            <button type="button" onClick={() => setZoomOpen(true)} className="flex h-[52vh] w-full cursor-zoom-in items-center justify-center rounded-md bg-muted lg:h-[68vh]">
              <SignedImg key={photo.id} eager path={viewPath(photo.front_path, photo.front_thumb_path, photo.front_view_path)} alt={photo.caption || photo.ph_id || "Photograph"} className="max-h-full max-w-full object-contain" />
            </button>
            <p className="text-xs text-muted-foreground">← → move between photographs · number keys 1–9 toggle the first nine categories</p>
          </div>
          <aside className="space-y-4">
            <CategoryPanel photo={photo} mine={mine} onToggle={toggle} />
            <BoxPicker photo={photo} />
            <DetailsPanel key={photo.id} photo={photo} onDeleted={() => { setIds((x) => x.filter((id) => id !== photo.id)); d.refresh(); }} />
          </aside>
        </div>
      )}
      {zoomOpen && photo && (
        <PhotoLightbox photos={list} index={Math.min(pos, list.length - 1)} canDownloadOriginal
          categoryNames={(p) => (d.byPhoto.get(p.id) ?? []).map((id) => d.catName.get(id) ?? "")}
          onIndex={setPos} onClose={() => setZoomOpen(false)} />
      )}
    </div>
  );
}

function CategoryPanel({ photo, mine, onToggle }: { photo: Photo; mine: string[]; onToggle: (id: string) => void }) {
  const d = usePhotoData();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const c = await createCategory(name, d.categories);
      if (!d.categories.some((x) => x.id === c.id)) d.patch((old) => ({ ...old, categories: [...old.categories, c] }));
      if (!mine.includes(c.id)) await setCategory([photo.id], c.id, true);
      d.patchLinks((links) => links.some((l) => l.photo_id === photo.id && l.category_id === c.id) ? links : [...links, { photo_id: photo.id, category_id: c.id }]);
      setName(""); setAdding(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section className="rounded-md border border-border p-3">
      <h2 className="mb-2 text-sm font-medium">Categories</h2>
      <div className="flex flex-wrap gap-1.5">
        {d.categories.map((c, i) => {
          const on = mine.includes(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} onClick={() => onToggle(c.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"}`}>
              {on && <Check className="size-3.5" />}{c.name}{i < 9 && <span className="ml-0.5 font-mono text-[10px] opacity-50">{i + 1}</span>}
            </button>
          );
        })}
      </div>
      {adding ? (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" onKeyDown={(e) => e.key === "Escape" && setAdding(false)} />
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Create"}</Button>
        </form>
      ) : (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAdding(true)}><Plus className="mr-1 size-4" />New Category</Button>
      )}
    </section>
  );
}

function BoxPicker({ photo }: { photo: Photo }) {
  const d = usePhotoData();
  const change = async (boxId: string | null) => {
    d.patch((old) => ({ ...old, photos: old.photos.map((p) => (p.id === photo.id ? { ...p, box_id: boxId } : p)) }));
    try { await assignBox([photo.id], boxId); } catch (e) { toast.error((e as Error).message); d.refresh(); }
  };
  return (
    <section className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
      <label htmlFor="org-box" className="font-medium">Storage box</label>
      <select id="org-box" value={photo.box_id ?? ""} onChange={(e) => void change(e.target.value || null)} className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5">
        <option value="">Not assigned</option>
        {d.boxes.map((b) => <option key={b.id} value={b.id}>{b.code}{b.name ? ` — ${b.name}` : ""}</option>)}
      </select>
    </section>
  );
}

const FIELDS: { key: keyof PhotoDetails; label: string; multi?: boolean; hint?: string }[] = [
  { key: "caption", label: "Subtitle", hint: "Jim's fifth birthday" },
  { key: "people", label: "People", hint: "Fran Harrington, Jacquelyn Harrington" },
  { key: "date_text", label: "Date / approximate date", hint: "Circa 1937 · 1940s · 1935–1940" },
  { key: "location", label: "Location", hint: "Worcester, Massachusetts" },
  { key: "inscription", label: "Original inscription (exactly as written)", multi: true },
  { key: "notes", label: "Description / notes", multi: true },
  { key: "info_source", label: "Information source", hint: "Written on reverse · Identified by Jim Harrington" },
  { key: "back_transcription", label: "Writing on the back (transcription)", multi: true },
];

function toDetails(p: Photo): PhotoDetails {
  return { caption: p.caption ?? "", people: p.people ?? "", date_text: p.date_text ?? "", location: p.location ?? "", inscription: p.inscription ?? "", notes: p.notes ?? "", info_source: p.info_source ?? "", back_transcription: p.back_transcription ?? "" };
}

function DetailsPanel({ photo, onDeleted }: { photo: Photo; onDeleted: () => void }) {
  const d = usePhotoData();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<PhotoDetails>(() => toDetails(photo));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saved = useRef(JSON.stringify(toDetails(photo)));
  const latest = useRef(v); latest.current = v;
  const backInput = useRef<HTMLInputElement>(null);
  const [backBusy, setBackBusy] = useState(false);

  const save = async () => {
    const snap = JSON.stringify(latest.current);
    if (snap === saved.current) return;
    setState("saving");
    try {
      await savePhotoDetails(photo.id, latest.current);
      saved.current = snap;
      setState("saved");
      d.refresh();
    } catch (e) { setState("error"); toast.error((e as Error).message); }
  };
  useEffect(() => { const t = setTimeout(() => void save(), 900); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [v]);
  // Flush pending typing when moving to another photograph.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { void save(); }, []);

  return (
    <section className="rounded-md border border-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium">
        <span>Photo Details</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Not saved" : "Optional"}
          <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block text-xs text-muted-foreground">
              {f.label}
              {f.multi
                ? <Textarea rows={3} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} onBlur={() => void save()} className="mt-1 text-sm text-foreground" />
                : <Input value={v[f.key]} placeholder={f.hint} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} onBlur={() => void save()} className="mt-1 text-sm text-foreground" />}
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input ref={backInput} type="file" accept="image/*,.tif,.tiff" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (!f) return;
              setBackBusy(true);
              try { await attachPhotoBack(photo.id, f); toast.success("Reverse side attached"); d.refresh(); }
              catch (err) { toast.error((err as Error).message); }
              finally { setBackBusy(false); }
            }} />
            <Button size="sm" variant="outline" disabled={backBusy} onClick={() => backInput.current?.click()}>
              {backBusy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <ImagePlus className="mr-1 size-4" />}
              {photo.back_path ? "Replace reverse side" : "Add reverse side"}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
              if (!confirm(`Delete ${photo.ph_id ?? "this photograph"}? Its PH number will not be reused.`)) return;
              try { await deletePhoto(photo); onDeleted(); } catch (e) { toast.error((e as Error).message); }
            }}><Trash2 className="mr-1 size-4" />Delete</Button>
          </div>
          {(photo.original_filename || photo.batch_id) && (
            <p className="text-xs text-muted-foreground">Uploaded {new Date(photo.created_at).toLocaleDateString()}{photo.original_filename ? ` as ${photo.original_filename}` : ""}</p>
          )}
        </div>
      )}
    </section>
  );
}
