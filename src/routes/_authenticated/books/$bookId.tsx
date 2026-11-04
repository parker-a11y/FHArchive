import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Download, FilePlus2, GripVertical, ImageUp, LayoutTemplate, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookPreview, useBookPlan } from "@/components/book/BookPreview";
import { PageEditor } from "@/components/book/PageEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TEMPLATES, templateName } from "@/lib/book/templates";
import {
  addCustomPage,
  addBookRecords,
  advanceBookExport,
  getBookEditor,
  getBookExportLink,
  getExportManifest,
  refreshBookSources,
  removeBookItem,
  reorderBookItems,
  retryBookExport,
  searchBookCandidates,
  sortBookItems,
  startBookExport,
  updateBook,
} from "@/lib/book/book.functions";
import { parseArchiveIds } from "@/lib/book/ids";
import { preparePrintCopy, printCopyTargets } from "@/lib/book/print-copies";
import { isPageEntry, recordEntries, type BookEntry, type BookPageSource, type BookRecordSource, type BookWarning } from "@/lib/book/types";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/books/$bookId")({
  head: () => ({
    meta: [
      { title: "Edit book — Book Builder" },
      { name: "description", content: "Arrange letters, preview pages and export a print-quality PDF." },
      { property: "og:title", content: "Edit book — Book Builder" },
      { property: "og:description", content: "Arrange letters, preview pages and export a print-quality PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <BookEditor />
    </AppShell>
  ),
});

type Editor = Awaited<ReturnType<typeof getBookEditor>>;

function BookEditor() {
  const { bookId } = Route.useParams();
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const key = ["book", bookId];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => getBookEditor({ data: { id: bookId } }), enabled: canEdit });
  const [order, setOrder] = useState<BookEntry[]>([]);
  useEffect(() => {
    if (data) setOrder(data.entries);
  }, [data]);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingAt, setAddingAt] = useState<number | null | undefined>(undefined);
  const meta = data?.meta ?? null;
  const { plan, fonts, error: fontErr } = useBookPlan(meta, order);
  const [jump, setJump] = useState<number | null>(null);

  if (!canEdit) return <p className="p-8 text-sm text-muted-foreground">Book Builder is available to administrators and archivists.</p>;
  if (isLoading || !data || !meta) return <p className="p-8 text-sm text-muted-foreground">{error ? (error as Error).message : "Loading book…"}</p>;

  const reload = () => qc.invalidateQueries({ queryKey: key });

  async function persistOrder(next: BookEntry[]) {
    setOrder(next);
    try {
      await reorderBookItems({ data: { bookId, itemIds: next.map((r) => r.itemId) } });
    } catch (e) {
      toast.error((e as Error).message);
      refetch();
    }
  }

  const firstPageOf = (itemId: string) => plan?.pages.find((p) => p.itemId === itemId)?.index ?? null;
  const pagesOf = (itemId: string) => plan?.pages.filter((p) => p.itemId === itemId).length ?? 0;
  const allWarnings: BookWarning[] = [...data.warnings, ...(plan?.warnings ?? [])];
  const blocking = allWarnings.filter((w) => w.level === "error");

  return (
    <>
      <PageHeader
        title={meta.title}
        description={`${recordEntries(order).length} record${recordEntries(order).length === 1 ? "" : "s"}${order.length - recordEntries(order).length ? ` · ${order.length - recordEntries(order).length} custom page${order.length - recordEntries(order).length === 1 ? "" : "s"}` : ""} · ${plan ? `${plan.pages.length} printed pages` : "calculating pages…"} · 8.5 × 11 in portrait · Classic Literary`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/books">All books</Link>
          </Button>
        }
      />
      <div className="space-y-6 p-4 md:p-6">
        <BookDetails data={data} onSaved={reload} />
        <div className="grid gap-6 xl:grid-cols-[minmax(380px,460px)_1fr]">
          <div className="space-y-6">
            <AddRecords bookId={bookId} count={order.length} onAdded={reload} />
            <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
              <h2 className="mr-auto font-serif text-lg">Custom pages</h2>
              <Button size="sm" onClick={() => setAddingAt(null)}><FilePlus2 className="mr-1 h-4 w-4" /> Add page</Button>
              <p className="w-full text-xs text-muted-foreground">Introductions, photo pages, dividers and research essays. Use the + on any row to insert a page right after it.</p>
            </section>
            <section className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center gap-2 border-b p-3">
                <h2 className="mr-auto font-serif text-lg">Book sequence</h2>
                <Button size="sm" variant="outline" onClick={async () => { await sortBookItems({ data: { bookId, mode: "oldest" } }); reload(); }}>Oldest first</Button>
                <Button size="sm" variant="outline" onClick={async () => { await sortBookItems({ data: { bookId, mode: "newest" } }); reload(); }}>Newest first</Button>
                {data.hasSavedOrder && (
                  <Button size="sm" variant="ghost" onClick={async () => { await sortBookItems({ data: { bookId, mode: "restore" } }); reload(); }}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore custom order
                  </Button>
                )}
              </div>
              <SequenceList
                records={order}
                warnings={data.warnings}
                pagesOf={pagesOf}
                firstPageOf={firstPageOf}
                onJump={setJump}
                onEditPage={(p) => setEditing(p.itemId)}
                onInsertAfter={(i) => setAddingAt(i + 1)}
                onMove={persistOrder}
                onRemove={async (r) => {
                  setOrder((o) => o.filter((x) => x.itemId !== r.itemId));
                  await removeBookItem({ data: { itemId: r.itemId } });
                  reload();
                }}
                onRefresh={async (r) => {
                  await refreshBookSources({ data: { bookId, itemIds: [r.itemId] } });
                  toast.success(`${isPageEntry(r) ? r.doc.name || "Page" : r.archiveId} refreshed to the archive's current version`);
                  reload();
                }}
              />
            </section>
          </div>
          <div className="space-y-6">
            <section className="rounded-lg border bg-card p-3">
              {fontErr && <p className="text-sm text-destructive">{fontErr}</p>}
              {plan && fonts ? <BookPreview plan={plan} fonts={fonts} jumpTo={jump} /> : <p className="p-6 text-sm text-muted-foreground">Preparing preview…</p>}
            </section>
            <WarningsPanel warnings={allWarnings} bookId={bookId} onRefreshed={reload} />
            <PrintCopiesPanel records={recordEntries(order)} onDone={reload} />
            <ExportPanel bookId={bookId} exports={data.exports} blocked={blocking.length > 0 || !order.length} onChange={reload} />
          </div>
        </div>
      </div>
      {addingAt !== undefined && (
        <TemplateChooser
          onClose={() => setAddingAt(undefined)}
          onChoose={async (template) => {
            try {
              const r = await addCustomPage({ data: { bookId, template, atPosition: addingAt ?? undefined } });
              setAddingAt(undefined);
              await qc.invalidateQueries({ queryKey: key });
              setEditing(r.id);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
      {editing && fonts && (() => {
        const entry = order.find((e): e is BookPageSource => isPageEntry(e) && e.itemId === editing);
        return entry ? <PageEditor key={editing} entry={entry} meta={meta} fonts={fonts} bookId={bookId} onClose={() => setEditing(null)} onSaved={reload} /> : null;
      })()}
    </>
  );
}

function TemplateChooser({ onClose, onChoose }: { onClose: () => void; onChoose: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl sm:max-w-3xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Choose a page template</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <Button key={t.id} variant="outline" disabled={busy} className="h-auto justify-start py-3 text-left" onClick={async () => { setBusy(true); await onChoose(t.id); setBusy(false); }}>
              <LayoutTemplate className="mr-2 h-4 w-4 shrink-0" /> {t.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BookDetails({ data, onSaved }: { data: Editor; onSaved: () => void }) {
  const [title, setTitle] = useState(data.meta.title);
  const [subtitle, setSubtitle] = useState(data.meta.subtitle ?? "");
  const save = async (patch: { id: string; title?: string; subtitle?: string | null; settings?: { scansPerPage: 1 | 2; titlePage: boolean; envelopeFirst: boolean } }) => {
    try {
      await updateBook({ data: patch });
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const s = data.meta.settings;
  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-[1fr_1fr_auto]">
      <div className="space-y-1">
        <Label htmlFor="bt">Title</Label>
        <Input id="bt" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== data.meta.title && save({ id: data.meta.id, title })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="bs">Subtitle</Label>
        <Input id="bs" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} onBlur={() => subtitle !== (data.meta.subtitle ?? "") && save({ id: data.meta.id, subtitle: subtitle || null })} />
      </div>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Switch id="tp" checked={s.titlePage} onCheckedChange={(v) => save({ id: data.meta.id, settings: { ...s, titlePage: v } })} />
          <Label htmlFor="tp">Title page</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ef" checked={s.envelopeFirst} onCheckedChange={(v) => save({ id: data.meta.id, settings: { ...s, envelopeFirst: v } })} />
          <Label htmlFor="ef">Classic Literary — Envelope First</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="two" disabled={s.envelopeFirst} checked={!s.envelopeFirst && s.scansPerPage === 2} onCheckedChange={(v) => save({ id: data.meta.id, settings: { ...s, scansPerPage: v ? 2 : 1 } })} />
          <Label htmlFor="two">Two letter scans per page</Label>
        </div>
      </div>
    </section>
  );
}

function AddRecords({ bookId, count, onAdded }: { bookId: string; count: number; onAdded: () => void }) {
  const [ids, setIds] = useState("");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ text: "", from: "", to: "", location: "", dateFrom: "", dateTo: "" });
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchBookCandidates>> | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const lastClick = useRef<number | null>(null);

  const position = () => {
    const n = Number(at);
    return at && Number.isFinite(n) && n >= 1 ? Math.min(n - 1, count) : undefined;
  };
  async function add(payload: { archiveIds?: string[]; letterIds?: string[] }) {
    setBusy(true);
    try {
      const r = await addBookRecords({ data: { bookId, ...payload, atPosition: position() } });
      toast.success(`Added ${r.added} record${r.added === 1 ? "" : "s"}${r.already ? ` · ${r.already} already in the book` : ""}`);
      if (r.notFound.length) toast.warning(`Not found: ${r.notFound.slice(0, 12).join(", ")}${r.notFound.length > 12 ? "…" : ""}`);
      setPicked(new Set());
      onAdded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="mr-auto font-serif text-lg">Add records</h2>
        <Label htmlFor="at" className="text-xs text-muted-foreground">Insert at #</Label>
        <Input id="at" className="h-8 w-16" placeholder="end" value={at} onChange={(e) => setAt(e.target.value.replace(/\D/g, ""))} />
      </div>
      <Tabs defaultValue="ids">
        <TabsList>
          <TabsTrigger value="ids">By archive ID</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>
        <TabsContent value="ids" className="space-y-2">
          <Input placeholder="FH0012, FH0040–FH0055, 77" value={ids} onChange={(e) => setIds(e.target.value)} onKeyDown={(e) => e.key === "Enter" && parseArchiveIds(ids).length && add({ archiveIds: parseArchiveIds(ids) })} />
          <Button size="sm" disabled={busy || !parseArchiveIds(ids).length} onClick={() => add({ archiveIds: parseArchiveIds(ids) })}>
            Add {parseArchiveIds(ids).length || ""} record{parseArchiveIds(ids).length === 1 ? "" : "s"}
          </Button>
        </TabsContent>
        <TabsContent value="search" className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Title or text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
            <Input placeholder="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
            <Input placeholder="From (sender)" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <Input placeholder="To (recipient)" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
            <Input type="date" aria-label="From date" value={f.dateFrom} onChange={(e) => setF({ ...f, dateFrom: e.target.value })} />
            <Input type="date" aria-label="To date" value={f.dateTo} onChange={(e) => setF({ ...f, dateTo: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => setResults(await searchBookCandidates({ data: f }))}>Search</Button>
            <Button size="sm" disabled={busy || !picked.size} onClick={() => add({ letterIds: [...picked] })}>Add {picked.size || ""} selected</Button>
            {results && results.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setPicked(picked.size === results.length ? new Set() : new Set(results.map((r) => r.id)))}>
                {picked.size === results.length ? "Clear" : "Select all"}
              </Button>
            )}
          </div>
          {results && (
            <div className="max-h-72 overflow-auto rounded border text-sm">
              {!results.length && <p className="p-3 text-muted-foreground">No matching records.</p>}
              {results.map((r, idx) => (
                <label key={r.id} className="flex cursor-pointer items-start gap-2 border-b p-2 last:border-0 hover:bg-muted/50"
                  onClick={(e) => {
                    if (e.shiftKey && lastClick.current !== null) {
                      e.preventDefault();
                      const [a, b] = [lastClick.current, idx].sort((x, y) => x - y);
                      const next = new Set(picked);
                      results.slice(a, b + 1).forEach((x) => next.add(x.id));
                      setPicked(next);
                    }
                    lastClick.current = idx;
                  }}
                >
                  <Checkbox checked={picked.has(r.id)} onCheckedChange={(v) => { const next = new Set(picked); v ? next.add(r.id) : next.delete(r.id); setPicked(next); }} />
                  <span>
                    <b>{r.archiveId}</b> · {r.date ?? "Undated"}
                    <span className="block text-xs text-muted-foreground">
                      {[r.author, r.recipient && `to ${r.recipient}`, r.location].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function SequenceList({
  records, warnings, pagesOf, firstPageOf, onJump, onMove, onRemove, onRefresh, onEditPage, onInsertAfter,
}: {
  records: BookEntry[];
  onEditPage: (p: BookPageSource) => void;
  onInsertAfter: (index: number) => void;
  warnings: BookWarning[];
  pagesOf: (id: string) => number;
  firstPageOf: (id: string) => number | null;
  onJump: (p: number) => void;
  onMove: (next: BookEntry[]) => void;
  onRemove: (r: BookEntry) => void;
  onRefresh: (r: BookEntry) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= records.length) return;
    const next = [...records];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onMove(next);
  };
  if (!records.length) return <p className="p-6 text-sm text-muted-foreground">No records yet. Add some above.</p>;
  return (
    <ol className="divide-y">
      {records.map((r, i) => {
        const stale = warnings.some((w) => w.itemId === r.itemId && w.level === "error");
        const first = firstPageOf(r.itemId);
        const handlers = {
          draggable: true,
          onDragStart: () => setDrag(i),
          onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(i); },
          onDragEnd: () => { setDrag(null); setOver(null); },
          onDrop: (e: React.DragEvent) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); },
        };
        const tools = (label: string) => (
          <>
            <Button size="icon" variant="ghost" aria-label={`Insert a custom page after ${label}`} title="Insert a custom page after this" onClick={() => onInsertAfter(i)}>
              <Plus className="h-4 w-4" />
            </Button>
            <div className="flex shrink-0 flex-col">
              <button type="button" aria-label="Move up" className="rounded p-0.5 hover:bg-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label="Move down" className="rounded p-0.5 hover:bg-muted disabled:opacity-30" disabled={i === records.length - 1} onClick={() => move(i, i + 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
            </div>
          </>
        );
        const rowClass = `flex items-center gap-2 p-2 text-sm ${over === i && drag !== null && drag !== i ? "bg-accent/40" : ""} ${drag === i ? "opacity-50" : ""}`;
        if (isPageEntry(r)) {
          const name = r.doc.name || templateName(r.doc.template);
          return (
            <li key={r.itemId} {...handlers} className={rowClass}>
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
              <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-sm border border-dashed bg-muted/40"><LayoutTemplate className="h-4 w-4 text-muted-foreground" /></div>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => first && onJump(first)} title="Show in preview">
                <span className="font-medium">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">Custom page · {templateName(r.doc.template)} · {pagesOf(r.itemId)} pp{first ? ` from p. ${first}` : ""}</span>
                {stale && <span className="mt-0.5 block text-xs font-medium text-destructive">An archive image on this page changed</span>}
              </button>
              {stale && (
                <Button size="icon" variant="outline" aria-label={`Refresh ${name}`} title="Accept the archive's current version" onClick={() => onRefresh(r)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="outline" aria-label={`Edit ${name}`} title="Edit this page" onClick={() => onEditPage(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              {tools(name)}
              <Button size="icon" variant="ghost" aria-label={`Remove ${name} from book`} title="Remove this page from the book" onClick={() => onRemove(r)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        }
        return (
          <li key={r.itemId} {...handlers} className={rowClass}>
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
            <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{i + 1}</span>
            {r.thumbUrl ? <img src={r.thumbUrl} alt="" className="h-12 w-9 shrink-0 rounded-sm border object-cover" /> : <div className="h-12 w-9 shrink-0 rounded-sm border bg-muted" />}
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => first && onJump(first)} title="Show in preview">
              <span className="font-medium">{r.archiveId}</span> · {r.dateLabel ?? "Undated"}
              <span className="block truncate text-xs text-muted-foreground">{[r.author, r.recipient && `to ${r.recipient}`, r.location].filter(Boolean).join(" · ") || r.title}</span>
              <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                <span>{r.scans.length} scan{r.scans.length === 1 ? "" : "s"}</span>
                <span>{r.envelopes.length ? "envelope ✓" : "no envelope"}</span>
                <span>{r.transcription ? (r.transcriptionVerified ? "transcription ✓" : "AI transcription") : "no transcription"}</span>
                <span>{pagesOf(r.itemId)} pp{first ? ` from p. ${first}` : ""}</span>
              </span>
              {stale && <span className="mt-0.5 block text-xs font-medium text-destructive">Changed in the archive since it was added</span>}
            </button>
            {stale && (
              <Button size="icon" variant="outline" aria-label={`Refresh ${r.archiveId}`} title="Accept the archive's current version" onClick={() => onRefresh(r)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {tools(r.archiveId)}
            <Button size="icon" variant="ghost" aria-label={`Remove ${r.archiveId} from book`} title="Remove from this book (the archive record stays)" onClick={() => onRemove(r)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

function WarningsPanel({ warnings, bookId, onRefreshed }: { warnings: BookWarning[]; bookId: string; onRefreshed: () => void }) {
  const [showInfo, setShowInfo] = useState(false);
  const errors = warnings.filter((w) => w.level === "error");
  const warn = warnings.filter((w) => w.level === "warning");
  const info = warnings.filter((w) => w.level === "info");
  if (!warnings.length)
    return <p className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm"><CheckCircle2 className="h-4 w-4" /> No missing material or resolution problems.</p>;
  const row = (w: BookWarning, i: number) => (
    <li key={i} className="text-sm">
      {w.archiveId && <b className="mr-1">{w.archiveId}</b>}
      {w.message}
    </li>
  );
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <h2 className="flex items-center gap-2 font-serif text-lg"><AlertTriangle className="h-4 w-4" /> Checks</h2>
      {errors.length > 0 && (
        <div className="rounded border border-destructive/50 p-2">
          <div className="mb-1 flex items-center">
            <p className="mr-auto text-sm font-medium text-destructive">Must be resolved before export</p>
            {errors.some((e) => /changed in the archive/.test(e.message)) && (
              <Button size="sm" variant="outline" onClick={async () => { const r = await refreshBookSources({ data: { bookId } }); toast.success(`Refreshed ${r.refreshed} record(s)`); onRefreshed(); }}>
                Refresh all changed
              </Button>
            )}
          </div>
          <ul className="list-disc space-y-0.5 pl-5">{errors.map(row)}</ul>
        </div>
      )}
      {warn.length > 0 && <ul className="list-disc space-y-0.5 pl-5">{warn.map(row)}</ul>}
      {info.length > 0 && (
        <div>
          <button type="button" className="text-xs underline" onClick={() => setShowInfo(!showInfo)}>{showInfo ? "Hide" : "Show"} {info.length} note{info.length === 1 ? "" : "s"}</button>
          {showInfo && <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">{info.map(row)}</ul>}
        </div>
      )}
    </section>
  );
}

function PrintCopiesPanel({ records, onDone }: { records: BookRecordSource[]; onDone: () => void }) {
  const targets = useMemo(() => printCopyTargets(records), [records]);
  const totalImages = records.reduce((a, r) => a + r.scans.length + r.envelopes.length, 0);
  const [run, setRun] = useState<{ done: number; failed: string[]; total: number } | null>(null);
  const running = run !== null && run.done + run.failed.length < run.total;
  async function start() {
    const list = targets;
    setRun({ done: 0, failed: [], total: list.length });
    let done = 0;
    const failed: string[] = [];
    for (const t of list) {
      try {
        await preparePrintCopy(t);
        done++;
      } catch (e) {
        failed.push(`${t.record.archiveId} ${t.image.label}: ${(e as Error).message}`);
      }
      setRun({ done, failed: [...failed], total: list.length });
    }
    onDone();
  }
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <h2 className="flex items-center gap-2 font-serif text-lg"><ImageUp className="h-4 w-4" /> Full-resolution print copies</h2>
      <p className="text-sm text-muted-foreground">
        {totalImages - targets.length} of {totalImages} images are using full-resolution print copies made from the original TIFF masters. The masters are never changed.
        {targets.length > 0 && " This step runs in this browser window, so keep the page open while it works. Exporting afterwards runs on the server and doesn't need the page."}
      </p>
      {targets.length > 0 && !running && <Button size="sm" onClick={start}>Prepare {targets.length} print cop{targets.length === 1 ? "y" : "ies"}</Button>}
      {run && (
        <div className="space-y-1">
          <Progress value={((run.done + run.failed.length) / Math.max(1, run.total)) * 100} />
          <p className="text-xs text-muted-foreground">{run.done} done{run.failed.length ? `, ${run.failed.length} could not be converted` : ""} of {run.total}</p>
          {run.failed.length > 0 && <ul className="list-disc pl-5 text-xs text-destructive">{run.failed.map((f) => <li key={f}>{f}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}

function ExportPanel({ bookId, exports, blocked, onChange }: { bookId: string; exports: Editor["exports"]; blocked: boolean; onChange: () => void }) {
  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState<Record<string, any>>({});
  const active = exports.find((e: any) => e.status === "queued" || e.status === "running");
  useEffect(() => {
    if (!active) return;
    let stop = false;
    (async () => {
      while (!stop) {
        try {
          const r: any = await advanceBookExport({ data: { exportId: active.id } });
          if (stop) break;
          setLive((l) => ({ ...l, [active.id]: r }));
          if (r.status === "done" || r.status === "failed") {
            onChange();
            break;
          }
        } catch {
          await new Promise((res) => setTimeout(res, 5000));
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    })();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  async function download(id: string, inline = false) {
    const { url } = await getBookExportLink({ data: { exportId: id } });
    window.open(inline ? `${url}&inline=1` : url, "_blank");
  }
  async function manifest(id: string) {
    const m = await getExportManifest({ data: { exportId: id } });
    const blob = new Blob([JSON.stringify(m, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `edition-record-${id.slice(0, 8)}.json`;
    a.click();
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto font-serif text-lg">Export PDF</h2>
        <Button
          disabled={blocked || starting || !!active}
          onClick={async () => {
            setStarting(true);
            try {
              await startBookExport({ data: { bookId } });
              onChange();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Create PDF
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Standard 8.5 × 11 in PDF for home printing and sharing, with fonts embedded and scans at their stored resolution. It is not yet tailored to a particular print company (Blurb, Lulu, BookBaby), so it is not labelled print-ready. The export runs on the server, so you can close this page; each PDF keeps a record of exactly which record versions it used.
      </p>
      {!exports.length && <p className="text-sm text-muted-foreground">No exports yet.</p>}
      <ul className="divide-y">
        {exports.map((e0: any) => {
          const e = { ...e0, ...(live[e0.id] ?? {}) };
          const pct = e.total ? Math.round((e.progress / e.total) * 100) : 0;
          return (
            <li key={e.id} className="space-y-1 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto">
                  {new Date(e.created_at).toLocaleString()} · {e.status === "done" ? `${e.page_count} pages · ${(Number(e.file_size) / 1e6).toFixed(1)} MB` : e.step ?? e.status}
                </span>
                {e.status === "done" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => download(e.id, true)}>Open</Button>
                    <Button size="sm" onClick={() => download(e.id)}><Download className="mr-1 h-4 w-4" />Download</Button>
                    <Button size="sm" variant="ghost" onClick={() => manifest(e.id)}>Edition record</Button>
                  </>
                )}
                {e.status === "failed" && (
                  <Button size="sm" variant="outline" onClick={async () => { await retryBookExport({ data: { exportId: e.id } }); onChange(); }}>Retry</Button>
                )}
              </div>
              {(e.status === "running" || e.status === "queued") && <Progress value={pct} />}
              {e.error && <p className="whitespace-pre-wrap text-xs text-destructive">{e.error}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
