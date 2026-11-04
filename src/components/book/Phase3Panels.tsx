/**
 * Book Builder Phase 3 panels: book design (theme, layout, printer, trim,
 * contents, front matter), chapter editing, cover designer and preflight.
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, Image as ImageIcon, Info, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImagePicker } from "@/components/book/ImagePicker";
import { PageView } from "@/components/book/BookPreview";
import { saveChapter, saveCover, startBookExport, updateBook } from "@/lib/book/book.functions";
import { THEME_LIST } from "@/lib/book/themes";
import { PRINTER_LIST, TRIMS, printerFor } from "@/lib/book/printers";
import { buildCoverPlan } from "@/lib/book/layout";
import type { BookFonts } from "@/lib/book/fonts";
import type { PreflightResult } from "@/lib/book/preflight";
import type { BookChapterSource, BookImage, BookMeta, BookSettings, ChapterDoc, CoverDoc } from "@/lib/book/types";

type FullSettings = Required<Pick<BookSettings, "scansPerPage" | "titlePage" | "envelopeFirst">> & BookSettings;

export function BookDesignPanel({ meta, onSaved }: { meta: BookMeta; onSaved: () => void }) {
  const s = meta.settings as FullSettings;
  const front = s.front ?? { colophon: false, colophonText: "", dedication: "" };
  const toc = s.toc ?? { enabled: false, records: false };
  const [colophonText, setColophonText] = useState(front.colophonText);
  const [dedication, setDedication] = useState(front.dedication);
  const trimId = meta.trimWidthIn === 6 && meta.trimHeightIn === 9 ? "6x9" : "8.5x11";
  const layout = s.facing ? "facing" : s.envelopeFirst ? "envelopeFirst" : "classic";
  const printer = printerFor(s.printer);

  const save = async (patch: Partial<BookSettings>, trim?: "8.5x11" | "6x9") => {
    try {
      await updateBook({ data: { id: meta.id, settings: { ...s, ...patch } as any, ...(trim ? { trim } : {}) } });
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const defaultColophon = `${meta.title}${meta.subtitle ? `\n${meta.subtitle}` : ""}\n\nLetters from The Francis Files,\na family archive of Francis A. Harrington.\n\nLetters are printed as written. Editor’s notes are marked.`;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <h2 className="flex items-center gap-2 font-serif text-lg"><BookOpen className="h-4 w-4" /> Book design</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <Label>Theme</Label>
          <Select value={s.theme ?? "classic"} onValueChange={(v) => save({ theme: v })}>
            <SelectTrigger aria-label="Theme"><SelectValue /></SelectTrigger>
            <SelectContent>{THEME_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{THEME_LIST.find((t) => t.id === (s.theme ?? "classic"))?.description}</p>
        </div>
        <div className="space-y-1">
          <Label>Letter layout</Label>
          <Select value={layout} onValueChange={(v) => save({ envelopeFirst: v !== "classic", facing: v === "facing" })}>
            <SelectTrigger aria-label="Letter layout"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="envelopeFirst">Envelope First</SelectItem>
              <SelectItem value="facing">Facing pages (scan left, transcription right)</SelectItem>
              <SelectItem value="classic">Original order (scans, envelope, transcription)</SelectItem>
            </SelectContent>
          </Select>
          {layout === "classic" && (
            <div className="flex items-center gap-2 pt-1 text-sm">
              <Switch id="two" checked={s.scansPerPage === 2} onCheckedChange={(v) => save({ scansPerPage: v ? 2 : 1 })} />
              <Label htmlFor="two">Two scans per page</Label>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label>Printer</Label>
          <Select value={printer.id} onValueChange={(v) => save({ printer: v })}>
            <SelectTrigger aria-label="Printer"><SelectValue /></SelectTrigger>
            <SelectContent>{PRINTER_LIST.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{printer.note}</p>
        </div>
        <div className="space-y-1">
          <Label>Page size</Label>
          <Select value={trimId} onValueChange={(v) => save({}, v as "8.5x11" | "6x9")}>
            <SelectTrigger aria-label="Page size"><SelectValue /></SelectTrigger>
            <SelectContent>{TRIMS.filter((t) => printer.trims.includes(t.id)).map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          {trimId === "6x9" && <p className="text-xs text-muted-foreground">Custom pages are scaled down from their 8.5 × 11 design.</p>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Switch id="tp" checked={s.titlePage} onCheckedChange={(v) => save({ titlePage: v })} />
            <Label htmlFor="tp">Title page</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="toc" checked={toc.enabled} onCheckedChange={(v) => save({ toc: { ...toc, enabled: v } })} />
            <Label htmlFor="toc">Table of contents</Label>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <Switch id="tocr" disabled={!toc.enabled} checked={toc.records} onCheckedChange={(v) => save({ toc: { ...toc, records: v } })} />
            <Label htmlFor="tocr">List every letter</Label>
          </div>
          <p className="text-xs text-muted-foreground">Contents lists chapters and research essays, with page numbers from the same layout as the PDF.</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Switch
              id="col"
              checked={front.colophon}
              onCheckedChange={(v) => {
                const text = v && !colophonText.trim() ? defaultColophon : colophonText;
                setColophonText(text);
                save({ front: { ...front, colophon: v, colophonText: text, dedication } });
              }}
            />
            <Label htmlFor="col">Copyright / colophon page</Label>
          </div>
          {front.colophon && (
            <Textarea rows={6} value={colophonText} onChange={(e) => setColophonText(e.target.value)} onBlur={() => colophonText !== front.colophonText && save({ front: { ...front, colophonText, dedication } })} aria-label="Colophon text" />
          )}
          <p className="text-xs text-muted-foreground">Printed exactly as written here, on the back of the title page.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ded">Dedication (optional)</Label>
          <Textarea id="ded" rows={4} value={dedication} placeholder="For …" onChange={(e) => setDedication(e.target.value)} onBlur={() => dedication !== front.dedication && save({ front: { ...front, colophonText, dedication } })} />
        </div>
      </div>
    </section>
  );
}

export function ChapterDialog({ initial, onClose, onSave }: { initial: ChapterDoc | null; onClose: () => void; onSave: (doc: ChapterDoc) => Promise<void> }) {
  const [doc, setDoc] = useState<ChapterDoc>(initial ?? { title: "", subtitle: "", epigraph: "", epigraphSource: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-serif">{initial ? "Edit chapter" : "Add chapter"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="ct">Chapter title</Label><Input id="ct" autoFocus value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} placeholder="Part One: Boot Camp" /></div>
          <div className="space-y-1"><Label htmlFor="cs">Subtitle (optional)</Label><Input id="cs" value={doc.subtitle ?? ""} onChange={(e) => setDoc({ ...doc, subtitle: e.target.value })} placeholder="December 1944 – March 1945" /></div>
          <div className="space-y-1"><Label htmlFor="ce">Epigraph (optional)</Label><Textarea id="ce" rows={3} value={doc.epigraph ?? ""} onChange={(e) => setDoc({ ...doc, epigraph: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="cq">Epigraph source</Label><Input id="cq" value={doc.epigraphSource ?? ""} onChange={(e) => setDoc({ ...doc, epigraphSource: e.target.value })} placeholder="Fran, letter of Dec. 27, 1944 (FH0001)" /></div>
          <p className="text-xs text-muted-foreground">The chapter opens on a right-hand page. Everything after it, up to the next chapter, belongs to it and its title runs at the top of left-hand pages.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !doc.title.trim()} onClick={async () => { setBusy(true); try { await onSave(doc); } finally { setBusy(false); } }}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save chapter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function saveChapterDoc(entry: BookChapterSource, doc: ChapterDoc) {
  await saveChapter({ data: { itemId: entry.itemId, doc } });
}

export function PreflightPanel({ result }: { result: PreflightResult | null }) {
  const [showInfo, setShowInfo] = useState(false);
  if (!result) return null;
  const errors = result.items.filter((i) => i.level === "error");
  const warns = result.items.filter((i) => i.level === "warning");
  const info = result.items.filter((i) => i.level === "info");
  const generic = result.printer === "generic";
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <h2 className="flex items-center gap-2 font-serif text-lg"><ShieldCheck className="h-4 w-4" /> Preflight</h2>
      <p className={`flex items-center gap-2 text-sm font-medium ${result.printReady ? "" : generic ? "text-muted-foreground" : "text-destructive"}`}>
        {result.printReady ? <CheckCircle2 className="h-4 w-4" /> : generic ? <Info className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {result.printReady ? `Passes every check for ${result.printerName}.` : generic ? "Proof only — choose a printer in Book design to check for print." : `Not print-ready for ${result.printerName}: ${errors.length} problem${errors.length === 1 ? "" : "s"} to fix. You can still export a proof.`}
      </p>
      {errors.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive">{errors.map((i, k) => <li key={k}>{i.archiveId && <b className="mr-1">{i.archiveId}</b>}{i.message}</li>)}</ul>}
      {warns.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-sm">{warns.map((i, k) => <li key={k}><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{i.message}</li>)}</ul>}
      {info.length > 0 && (
        <div>
          <button type="button" className="text-xs underline" onClick={() => setShowInfo(!showInfo)}>{showInfo ? "Hide" : "Show"} {info.length} note{info.length === 1 ? "" : "s"}</button>
          {showInfo && <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{info.map((i, k) => <li key={k}>{i.message}</li>)}</ul>}
        </div>
      )}
      {result.printReady && <p className="text-xs text-muted-foreground">Printers change their rules from time to time; their upload page runs its own final check.</p>}
    </section>
  );
}

export function CoverPanel({
  bookId, meta, fonts, interiorPages, initial, initialImage, onSaved, exportBlocked,
}: {
  bookId: string; meta: BookMeta; fonts: BookFonts | null; interiorPages: number; initial: CoverDoc; initialImage: BookImage | null; onSaved: () => void; exportBlocked: boolean;
}) {
  const [doc, setDoc] = useState<CoverDoc>(initial);
  const [image, setImage] = useState<BookImage | null>(initialImage);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setDoc(initial); setImage(initialImage); setDirty(false); }, [initial, initialImage]);
  const plan = useMemo(() => (fonts ? buildCoverPlan(meta, doc, image, interiorPages, fonts) : null), [fonts, meta, doc, image, interiorPages]);
  const set = (p: Partial<CoverDoc>) => { setDoc({ ...doc, ...p }); setDirty(true); };
  async function save() {
    setSaving(true);
    try {
      await saveCover({ data: { bookId, doc: doc as any } });
      setDirty(false);
      toast.success("Cover saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const scale = plan ? Math.min(1, 640 / plan.widthPt) : 1;
  const asc = fonts ? fonts.regular.ascent / fonts.regular.unitsPerEm : 0.8;
  const lineH = fonts ? (fonts.regular.ascent - fonts.regular.descent) / fonts.regular.unitsPerEm : 1.2;
  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 font-serif text-lg"><ImageIcon className="h-4 w-4" /> Cover</h2>
        <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={save}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save cover</Button>
        <Button
          size="sm"
          disabled={dirty || exportBlocked}
          title={dirty ? "Save the cover first" : undefined}
          onClick={async () => {
            try {
              await startBookExport({ data: { bookId, kind: "cover" } });
              onSaved();
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Create cover PDF
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Design</Label>
          <Select value={doc.template} onValueChange={(v) => set({ template: v as CoverDoc["template"] })}>
            <SelectTrigger aria-label="Cover design"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">Classic — paper colour, title and framed photo</SelectItem>
              <SelectItem value="photo">Photo — full photo front, title band</SelectItem>
              <SelectItem value="cloth">Cloth — solid colour from the theme</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Photo</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPicking(true)}>{image ? "Change photo" : "Choose photo"}</Button>
            {image && <Button size="sm" variant="ghost" onClick={() => { setImage(null); set({ image: null }); }}>Remove</Button>}
          </div>
          {doc.template === "photo" && !image && <p className="text-xs text-muted-foreground">The Photo design needs a photo.</p>}
        </div>
        <div className="space-y-1"><Label htmlFor="cvt">Title</Label><Input id="cvt" value={doc.title} onChange={(e) => set({ title: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="cvs">Subtitle</Label><Input id="cvs" value={doc.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="cva">Author / compiler line</Label><Input id="cva" value={doc.author} onChange={(e) => set({ author: e.target.value })} placeholder="Edited by …" /></div>
        <div className="flex items-end gap-2 pb-2 text-sm"><Switch id="cvsp" checked={doc.spineText} onCheckedChange={(v) => set({ spineText: v })} /><Label htmlFor="cvsp">Title on the spine</Label></div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="cvb">Back cover text</Label><Textarea id="cvb" rows={4} value={doc.backText} onChange={(e) => set({ backText: e.target.value })} /></div>
      </div>
      {plan && (
        <div className="space-y-1">
          <div className="overflow-auto rounded-md bg-muted/60 p-3">
            <div className="mx-auto w-max"><PageView page={plan.pages[0]} plan={plan} scale={scale} asc={asc} lineH={lineH} guides={false} /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Back · spine · front. {(plan.widthPt / 72).toFixed(3)} × {(plan.heightPt / 72).toFixed(3)} in including bleed; spine {plan.spineIn.toFixed(3)} in for {interiorPages} pages ({printerFor(meta.settings.printer).name}).
          </p>
          {plan.warnings.map((w, k) => <p key={k} className="text-xs text-muted-foreground">{w.message}</p>)}
        </div>
      )}
      {picking && (
        <ImagePicker
          bookId={bookId}
          onClose={() => setPicking(false)}
          onPick={(p) => {
            setImage(p.preview);
            set({ image: p.ref });
            setPicking(false);
          }}
        />
      )}
    </section>
  );
}
