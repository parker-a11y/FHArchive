import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Feather, Loader2, Plus, Send, Settings2, Trash2, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { sanitizeRichHtml } from "@/lib/rich-text";
import {
  deleteWriterSession,
  getWriterSession,
  getWriterSettings,
  listWriterSessions,
  saveWriterSettings,
  sendWriterMessage,
} from "@/lib/writer.functions";

type Search = { ids?: string; session?: string };

export const Route = createFileRoute("/_authenticated/writer")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ids: typeof s.ids === "string" ? s.ids : undefined,
    session: typeof s.session === "string" ? s.session : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Writing Assistant — Francis Files" },
      { name: "description", content: "Draft blog posts and emails from selected archive letters with saved AI conversations." },
      { property: "og:title", content: "Writing Assistant — Francis Files" },
      { property: "og:description", content: "Draft blog posts and emails from selected archive letters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WriterPage,
});

type Msg = { role: "user" | "assistant"; content: string; at: string };
type Rec = { id: string; archive_id: string; title: string | null; date_as_written?: string | null; normalized_date?: string | null };

function WriterPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(search.session ?? null);
  const [ids, setIds] = useState<string[]>(() => fitWriterIds(parse(search.ids ?? "")).ids);
  const [excess, setExcess] = useState<string[]>(() => fitWriterIds(parse(search.ids ?? "")).dropped);
  const [records, setRecords] = useState<Rec[]>([]);
  const [idInput, setIdInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const sessions = useQuery({ queryKey: ["writer-sessions"], queryFn: () => listWriterSessions() });

  function applyIds(next: string[]) {
    const fitted = fitWriterIds(next);
    setIds(fitted.ids);
    setExcess(fitted.dropped);
  }

  function attachNextBatch() {
    applyIds(excess);
  }

  useEffect(() => {
    if (!sessionId) return;
    getWriterSession({ data: { id: sessionId } })
      .then(({ session, records }) => {
        setMessages(session.messages ?? []);
        applyIds(session.record_ids ?? []);
        setRecords(records as Rec[]);
      })
      .catch((e) => toast.error(e.message));
  }, [sessionId]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages.length, busy]);

  function startNew() {
    setSessionId(null);
    setMessages([]);
    applyIds([]);
    setRecords([]);
    navigate({ search: {} });
  }

  async function send() {
    if (busy) return;
    if (!ids.length && !prompt.trim()) return toast.error("Add at least one FH record or type a prompt.");
    const text = prompt.trim();
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text || (m.length ? "Please continue." : "Write a blog post from these records."), at: new Date().toISOString() }]);
    setPrompt("");
    try {
      const res = await sendWriterMessage({ data: { sessionId, recordIds: ids, prompt: text } });
      if (!sessionId) {
        setSessionId(res.sessionId);
        navigate({ search: { session: res.sessionId }, replace: true });
      } else {
        const { session, records } = await getWriterSession({ data: { id: res.sessionId } });
        setMessages(session.messages ?? []);
        setRecords(records as Rec[]);
      }
      qc.invalidateQueries({ queryKey: ["writer-sessions"] });
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => m.slice(0, -1));
      setPrompt(text);
    } finally {
      setBusy(false);
    }
  }

  const refs = records
    .filter((r) => ids.includes(r.archive_id))
    .map((r) => ({ kind: "letter" as const, id: r.id, identifier: r.archive_id, title: r.title, date: r.date_as_written ?? r.normalized_date ?? null }));

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r pr-3 md:flex">
        <Button onClick={startNew} className="gap-2"><Plus className="size-4" /> New session</Button>
        <Button variant="outline" onClick={() => setSettingsOpen(true)} className="gap-2"><Settings2 className="size-4" /> Standing instructions</Button>
        <div className="mt-2 text-xs font-medium uppercase text-muted-foreground">History</div>
        {(sessions.data ?? []).map((s: any) => (
          <div key={s.id} className={`group flex items-start gap-1 rounded p-2 text-sm hover:bg-muted ${s.id === sessionId ? "bg-muted" : ""}`}>
            <button className="flex-1 text-left" onClick={() => { setSessionId(s.id); navigate({ search: { session: s.id } }); }}>
              <div className="line-clamp-2 font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{(s.record_ids ?? []).join(", ")}</div>
            </button>
            <button
              aria-label="Delete session"
              className="opacity-0 group-hover:opacity-100"
              onClick={async () => {
                if (!confirm("Delete this session?")) return;
                await deleteWriterSession({ data: { id: s.id } });
                if (s.id === sessionId) startNew();
                qc.invalidateQueries({ queryKey: ["writer-sessions"] });
              }}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <Feather className="size-5 text-primary" />
          <h1 className="font-serif text-xl">Writing Assistant</h1>
          <div className="ml-auto flex gap-2 md:hidden">
            <Button size="sm" variant="outline" onClick={startNew}>New</Button>
            <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>Instructions</Button>
          </div>
        </div>
        {excess.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <span>
              The assistant reads up to {WRITER_MAX_RECORDS} letters at a time. You sent {ids.length + excess.length} — the first{" "}
              {ids.length} are attached, and {excess.length} are not ({excess.slice(0, 4).join(", ")}
              {excess.length > 4 ? `, +${excess.length - 4} more` : ""}).
            </span>
            <Button size="sm" variant="outline" onClick={attachNextBatch}>
              Attach the next {Math.min(WRITER_MAX_RECORDS, excess.length)} instead
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 py-3">
          <span className="text-sm text-muted-foreground">Records ({ids.length}):</span>
          {ids.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-sm">
              <Link to="/letters/$archiveId" params={{ archiveId: id }} className="hover:underline">{id}</Link>
              <button aria-label={`Remove ${id}`} onClick={() => applyIds(ids.filter((y) => y !== id))}><X className="size-3" /></button>
            </span>
          ))}
          <Input
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyIds([...ids, ...parse(idInput)]);
                setIdInput("");
              }
            }}
            placeholder="Add FH number, e.g. 42 or FH0042"
            className="h-8 w-56"
          />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded border bg-card p-4">
          {messages.length === 0 && !busy && (
            <p className="text-sm text-muted-foreground">
              The selected letters' transcriptions, dates, From/To, envelope and location details are sent automatically.
              Type an instruction below, or just press Write to get a blog post in your standing style.
            </p>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary/10 px-3 py-2 text-sm">{m.content}</div>
            ) : (
              <div key={i} className="space-y-2">
                <div className="prose prose-sm max-w-none font-serif" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(m.content) }} />
                <div className="flex flex-wrap gap-2">
                  <EmailArchiveDialog
                    records={refs}
                    autosaveScope={`writer-${sessionId ?? "new"}-${i}`}
                    defaultSubject={titleOf(m.content)}
                    defaultMessage={bodyOf(m.content)}
                    trigger={<Button size="sm" variant="outline" className="gap-2"><Mail className="size-4" /> Use in email or blog</Button>}
                  />
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(htmlToText(m.content)).then(() => toast.success("Copied"))}>Copy</Button>
                </div>
              </div>
            ),
          )}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Writing… (this can take a minute)</div>}
          <div ref={bottom} />
        </div>

        <div className="flex gap-2 pt-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            placeholder={messages.length ? "Ask for changes — e.g. shorter, add the quote about the train…" : "Optional prompt (⌘/Ctrl+Enter to send)"}
            className="min-h-[70px]"
          />
          <Button onClick={send} disabled={busy} className="gap-2 self-end"><Send className="size-4" /> {messages.length ? "Send" : "Write"}</Button>
        </div>
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) getWriterSettings().then((s) => setText(s.instructions)).catch((e) => toast.error(e.message));
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Standing instructions</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Every session follows these, like a ChatGPT Project's instructions.</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-[60vh] font-mono text-xs" />
        <div className="flex justify-end">
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await saveWriterSettings({ data: { instructions: text } });
                toast.success("Instructions saved");
                onOpenChange(false);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function parse(v: string) {
  return Array.from(
    new Set(
      v
        .toUpperCase()
        .split(/[\s,;]+/)
        .map((x) => x.replace(/^FH-?/, ""))
        .filter((x) => /^\d{1,4}$/.test(x))
        .map((x) => `FH${x.padStart(4, "0")}`),
    ),
  );
}
function titleOf(html: string) {
  const m = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}
function bodyOf(html: string) {
  return html.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, "").trim();
}
function htmlToText(html: string) {
  const d = document.createElement("div");
  d.innerHTML = html.replace(/<\/(p|h2|blockquote)>/gi, "\n\n");
  return (d.textContent ?? "").trim();
}
