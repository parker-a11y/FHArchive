/**
 * Visual editor for one custom book page. The page underneath is rendered by
 * the same layout engine as the preview and PDF, so what you see is exactly
 * what prints; the boxes on top are only handles for moving and resizing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Bold, ImagePlus, Italic, Loader2, Redo2, Trash2, Type, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageView } from "@/components/book/BookPreview";
import { ImagePicker, type PickedImage } from "@/components/book/ImagePicker";
import type { BookFonts } from "@/lib/book/fonts";
import { buildPlan } from "@/lib/book/layout";
import { imageBox, PAGE_H, PAGE_W, SAFE, snapBox, sortedBoxes, textBox } from "@/lib/book/templates";
import { saveCustomPage } from "@/lib/book/book.functions";
import type { BookImage, BookMeta, BookPageSource, CustomPageDoc, PageBox, PageImageBox, PageTextBox } from "@/lib/book/types";

type Drag = { id: string; mode: "move" | "resize"; startX: number; startY: number; orig: PageBox; moved: boolean };

export function PageEditor({ entry, meta, fonts, bookId, onClose, onSaved }: { entry: BookPageSource; meta: BookMeta; fonts: BookFonts; bookId: string; onClose: () => void; onSaved: () => void }) {
  const [doc, setDoc] = useState<CustomPageDoc>(entry.doc);
  const [past, setPast] = useState<CustomPageDoc[]>([]);
  const [future, setFuture] = useState<CustomPageDoc[]>([]);
  const [images, setImages] = useState<Record<string, BookImage | null>>(entry.images);
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<Array<{ axis: "x" | "y"; at: number }>>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const scale = 0.82;
  const canvas = useRef<HTMLDivElement>(null);

  const commit = useCallback((next: CustomPageDoc, prev: CustomPageDoc = doc) => {
    setPast((p) => [...p.slice(-80), prev]);
    setFuture([]);
    setDoc(next);
    setDirty(true);
  }, [doc]);
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [doc, ...f]);
    setDoc(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setDirty(true);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, doc]);
    setDoc(future[0]);
    setFuture((f) => f.slice(1));
    setDirty(true);
  };
  const updateBox = (id: string, patch: Partial<PageTextBox> | Partial<PageImageBox>) =>
    commit({ ...doc, boxes: doc.boxes.map((b) => (b.id === id ? ({ ...b, ...patch } as PageBox) : b)) });
  const removeBox = (id: string) => {
    commit({ ...doc, boxes: doc.boxes.filter((b) => b.id !== id) });
    setSel(null);
  };
  const restack = (id: string, dir: 1 | -1) => {
    const zs = doc.boxes.map((b) => b.z ?? 0);
    const z = dir > 0 ? Math.max(0, ...zs) + 1 : Math.min(0, ...zs) - 1;
    updateBox(id, { z });
  };

  const selected = doc.boxes.find((b) => b.id === sel) ?? null;

  const plan = useMemo(() => {
    const m: BookMeta = { ...meta, settings: { ...meta.settings, titlePage: false } };
    return buildPlan(m, [{ ...entry, doc, images }], fonts);
  }, [meta, entry, doc, images, fonts]);
  const asc = fonts.regular.ascent / fonts.regular.unitsPerEm;
  const lineH = (fonts.regular.ascent - fonts.regular.descent) / fonts.regular.unitsPerEm;

  // keyboard: undo/redo, delete, nudge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing || !selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeBox(selected.id);
      }
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        updateBox(selected.id, { x: selected.x + d[0], y: selected.y + d[1] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onPointerDown(e: React.PointerEvent, b: PageBox, mode: Drag["mode"]) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSel(b.id);
    setDrag({ id: b.id, mode, startX: e.clientX, startY: e.clientY, orig: b, moved: false });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    const o = drag.orig;
    const raw = drag.mode === "move" ? { x: o.x + dx, y: o.y + dy, w: o.w, h: o.h } : { x: o.x, y: o.y, w: o.w + dx, h: o.h + dy };
    const others = doc.boxes.filter((b) => b.id !== drag.id);
    const { box, guides: g } = e.altKey ? { box: { ...raw, w: Math.max(18, raw.w), h: Math.max(14, raw.h) }, guides: [] } : snapBox(raw, others, drag.mode);
    setGuides(g);
    setDoc((d) => ({ ...d, boxes: d.boxes.map((b) => (b.id === drag.id ? ({ ...b, ...box } as PageBox) : b)) }));
    if (!drag.moved) setDrag({ ...drag, moved: true });
  }
  function onPointerUp() {
    if (drag?.moved) {
      // record the pre-drag state for undo
      const before = { ...doc, boxes: doc.boxes.map((b) => (b.id === drag.id ? drag.orig : b)) };
      setPast((p) => [...p.slice(-80), before]);
      setFuture([]);
      setDirty(true);
    }
    setDrag(null);
    setGuides([]);
  }

  function addText() {
    const b = textBox(SAFE.x + 40, SAFE.y + 40, SAFE.w - 80, 120, "body", "New text");
    commit({ ...doc, boxes: [...doc.boxes, b] });
    setSel(b.id);
  }
  function addImage() {
    const b = imageBox(SAFE.x + 60, SAFE.y + 60, SAFE.w - 120, 300, "fit");
    commit({ ...doc, boxes: [...doc.boxes, b] });
    setSel(b.id);
    setPicking(true);
  }
  function onPicked(p: PickedImage) {
    if (!selected || selected.kind !== "image") return;
    setImages((m) => ({ ...m, [selected.id]: p.preview }));
    updateBox(selected.id, { ref: p.ref });
    setPicking(false);
  }

  async function save(close: boolean) {
    setSaving(true);
    try {
      await saveCustomPage({ data: { itemId: entry.itemId, doc } });
      setDirty(false);
      onSaved();
      if (close) onClose();
      else toast.success("Page saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const first = plan.pages[0];
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { if (dirty && !confirm("Close without saving your changes to this page?")) return; onClose(); } }}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[1240px] sm:max-w-[1240px] flex-col gap-3 overflow-hidden p-4">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit page — {doc.name || "Custom page"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          <Button size="sm" variant="outline" onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
          {!doc.flow && (
            <>
              <Button size="sm" variant="outline" onClick={addText}><Type className="mr-1 h-4 w-4" /> Text box</Button>
              <Button size="sm" variant="outline" onClick={addImage}><ImagePlus className="mr-1 h-4 w-4" /> Image box</Button>
            </>
          )}
          <div className="ml-2 flex items-center gap-2 text-sm">
            <Switch id="pf" checked={doc.folio} onCheckedChange={(v) => commit({ ...doc, folio: v })} />
            <Label htmlFor="pf">Page number</Label>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{doc.flow ? `${plan.pages.length} printed page${plan.pages.length === 1 ? "" : "s"}` : "Drag to move · corner to resize · hold Alt to skip snapping · arrows nudge"}</span>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => save(false)}>Save</Button>
          <Button size="sm" disabled={saving} onClick={() => save(true)}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save &amp; close</Button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_320px]">
          <div className="min-h-0 overflow-auto rounded-md bg-muted/60 p-4" onPointerDown={() => setSel(null)}>
            {doc.flow ? (
              <div className="mx-auto flex w-max flex-col gap-3">
                {plan.pages.map((p) => <PageView key={p.index} page={p} plan={plan} scale={0.6} asc={asc} lineH={lineH} guides={false} />)}
              </div>
            ) : (
              <div ref={canvas} className="relative mx-auto" style={{ width: PAGE_W * scale, height: PAGE_H * scale }} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                {first && <PageView page={first} plan={plan} scale={scale} asc={asc} lineH={lineH} guides={false} />}
                <div className="pointer-events-none absolute border border-dashed" style={{ borderColor: "var(--book-guide)", opacity: 0.35, left: SAFE.x * scale, top: SAFE.y * scale, width: SAFE.w * scale, height: SAFE.h * scale }} />
                {guides.map((g, i) => (
                  <div key={i} className="pointer-events-none absolute" style={g.axis === "x" ? { left: g.at * scale, top: 0, bottom: 0, borderLeft: "1px solid var(--book-guide)" } : { top: g.at * scale, left: 0, right: 0, borderTop: "1px solid var(--book-guide)" }} />
                ))}
                {sortedBoxes(doc.boxes).map((b) => {
                  const r = b.kind === "image" && b.mode === "bleed" ? { x: 0, y: 0, w: PAGE_W, h: PAGE_H } : b;
                  const empty = b.kind === "image" && !images[b.id];
                  return (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      aria-label={b.kind === "text" ? `Text box: ${b.text.slice(0, 40)}` : "Image box"}
                      className={`absolute cursor-move touch-none ${sel === b.id ? "outline outline-2 outline-primary" : "outline-dashed outline-1 outline-muted-foreground/40 hover:outline-primary/60"}`}
                      style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }}
                      onPointerDown={(e) => onPointerDown(e, b, "move")}
                      onDoubleClick={() => b.kind === "image" && setPicking(true)}
                    >
                      {empty && (
                        <button type="button" className="flex h-full w-full items-center justify-center bg-muted/40 text-xs text-muted-foreground" onPointerDown={(e) => e.stopPropagation()} onClick={() => { setSel(b.id); setPicking(true); }}>
                          <ImagePlus className="mr-1 h-4 w-4" /> Choose image
                        </button>
                      )}
                      {sel === b.id && !(b.kind === "image" && b.mode === "bleed") && (
                        <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm bg-primary" onPointerDown={(e) => onPointerDown(e, b, "resize")} aria-hidden />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <aside className="min-h-0 space-y-4 overflow-auto pr-1 text-sm">
            <div className="space-y-1">
              <Label htmlFor="pn">Page name (for your list only)</Label>
              <Input id="pn" value={doc.name ?? ""} onChange={(e) => { setDoc({ ...doc, name: e.target.value }); setDirty(true); }} />
            </div>
            {doc.flow && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="eh">Essay heading</Label>
                  <Input id="eh" value={doc.flow.heading ?? ""} onChange={(e) => { setDoc({ ...doc, flow: { ...doc.flow!, heading: e.target.value } }); setDirty(true); }} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="et">Essay text</Label>
                  <Textarea id="et" className="min-h-[50vh] font-serif" placeholder="Paste or write your research here. Leave a blank line between paragraphs." value={doc.flow.text} onChange={(e) => { setDoc({ ...doc, flow: { ...doc.flow!, text: e.target.value } }); setDirty(true); }} />
                  <p className="text-xs text-muted-foreground">Printed in a brown ink and labelled “Modern commentary”, so it reads clearly apart from the letters. It flows onto as many pages as it needs.</p>
                </div>
              </>
            )}
            {!doc.flow && !selected && <p className="text-muted-foreground">Select a box on the page to edit it, or add a new text or image box.</p>}
            {selected?.kind === "text" && <TextInspector box={selected} onChange={(p) => updateBox(selected.id, p)} onLive={(p) => { setDoc((d) => ({ ...d, boxes: d.boxes.map((b) => (b.id === selected.id ? ({ ...b, ...p } as PageBox) : b)) })); setDirty(true); }} onCommitText={(prevText) => setPast((p) => [...p, { ...doc, boxes: doc.boxes.map((b) => (b.id === selected.id ? { ...b, text: prevText } as PageBox : b)) }])} />}
            {selected?.kind === "image" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {images[selected.id]?.previewUrl ? <img src={images[selected.id]!.previewUrl!} alt="" className="h-14 w-14 rounded border object-cover" /> : <div className="h-14 w-14 rounded border bg-muted" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{images[selected.id]?.label ?? "No image chosen"}</p>
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => setPicking(true)}>{images[selected.id] ? "Replace image" : "Choose image"}</Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Placement</Label>
                  <Select value={selected.mode} onValueChange={(v) => updateBox(selected.id, { mode: v as PageImageBox["mode"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fit">Fit — whole image, never cropped</SelectItem>
                      <SelectItem value="fill">Fill — fills the box (edges cropped on the page only)</SelectItem>
                      <SelectItem value="bleed">Full-bleed — edge to edge of the page</SelectItem>
                    </SelectContent>
                  </Select>
                  {selected.mode !== "fit" && <p className="text-xs text-muted-foreground">The original file is never cropped or changed; only how much of it shows on this page.</p>}
                </div>
                {selected.mode !== "bleed" && (
                  <div className="space-y-1">
                    <Label htmlFor="cap">Caption</Label>
                    <Input id="cap" value={selected.caption ?? ""} onChange={(e) => updateBox(selected.id, { caption: e.target.value })} />
                  </div>
                )}
              </div>
            )}
            {selected && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" onClick={() => restack(selected.id, 1)}><ArrowUpToLine className="mr-1 h-4 w-4" /> Bring forward</Button>
                <Button size="sm" variant="outline" onClick={() => restack(selected.id, -1)}><ArrowDownToLine className="mr-1 h-4 w-4" /> Send back</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeBox(selected.id)}><Trash2 className="mr-1 h-4 w-4" /> Delete box</Button>
              </div>
            )}
            {plan.warnings.length > 0 && (
              <ul className="list-disc space-y-0.5 border-t pl-5 pt-3 text-xs text-muted-foreground">
                {[...new Set(plan.warnings.map((w) => w.message))].map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
          </aside>
        </div>
        {picking && <ImagePicker bookId={bookId} onClose={() => setPicking(false)} onPick={onPicked} />}
      </DialogContent>
    </Dialog>
  );
}

function TextInspector({ box, onChange, onLive, onCommitText }: { box: PageTextBox; onChange: (p: Partial<PageTextBox>) => void; onLive: (p: Partial<PageTextBox>) => void; onCommitText: (prev: string) => void }) {
  const before = useRef(box.text);
  useEffect(() => { before.current = box.text; }, [box.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="tt">Text</Label>
        <Textarea
          id="tt"
          className="min-h-40 font-serif"
          value={box.text}
          onChange={(e) => onLive({ text: e.target.value })}
          onBlur={() => { if (before.current !== box.text) { onCommitText(before.current); before.current = box.text; } }}
        />
      </div>
      <div className="space-y-1">
        <Label>Style</Label>
        <Select value={box.style} onValueChange={(v) => onChange({ style: v as PageTextBox["style"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="heading">Heading</SelectItem>
            <SelectItem value="body">Body</SelectItem>
            <SelectItem value="caption">Caption</SelectItem>
            <SelectItem value="quote">Quotation</SelectItem>
            <SelectItem value="note">Editor’s note (modern commentary)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1">
        {(["left", "center", "right"] as const).map((a) => {
          const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
          return <Button key={a} size="icon" variant={box.align === a ? "default" : "outline"} aria-label={`Align ${a}`} aria-pressed={box.align === a} onClick={() => onChange({ align: a })}><Icon className="h-4 w-4" /></Button>;
        })}
        <Button size="icon" variant={box.bold ? "default" : "outline"} aria-label="Bold" aria-pressed={!!box.bold} onClick={() => onChange({ bold: !box.bold })}><Bold className="h-4 w-4" /></Button>
        <Button size="icon" variant={box.italic ? "default" : "outline"} aria-label="Italic" aria-pressed={!!box.italic} onClick={() => onChange({ italic: !box.italic })}><Italic className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
