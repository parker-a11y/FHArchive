import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Copy,
  CornerDownRight,
  Database,
  FileStack,
  Gavel,
  Loader2,
  NotebookPen,
  RefreshCw,
  Send,
  Share2,

} from "lucide-react";
import askIcon from "@/assets/ask-francis.png";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { askFrancis, refreshResearchSnapshot } from "@/lib/research.functions";
import { postArchiveNote } from "@/lib/archive-notes";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { LensPanel } from "@/components/research/LensPanel";


export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "Ask Francis — Research the archive" },
      {
        name: "description",
        content:
          "Ask research questions across every Francis Files record — transcriptions, people, places and events — with FH source citations on every answer.",
      },
      { property: "og:title", content: "Ask Francis — Research the archive" },
      {
        property: "og:description",
        content: "Natural-language research across the whole Francis Files archive, with cited FH records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <AskFrancis />
    </AppShell>
  ),
});

const EXAMPLES = [
  "Where was Jacqueline living during the winter of 1944?",
  "Find letters where Francis seems anxious about going to the Philippines.",
  "What people appear most frequently in Francis's wartime correspondence?",
  "Show evidence connecting Francis to the Hotel Vendome.",
  "How does Francis's tone change during his Pacific deployment?",
  "Find contradictions about a particular event or date.",
];

/**
 * Research output types. "Answer" is the conversational thread; the other
 * lenses read the same research index a different way.
 */
const LENSES = [
  { key: "answer", label: "Answer" },
  { key: "timeline", label: "Timeline" },
  { key: "people", label: "People network" },
  { key: "map", label: "Map" },
  { key: "themes", label: "Theme analysis" },
  { key: "contradictions", label: "Contradictions" },
] as const;

type LensKey = (typeof LENSES)[number]["key"];

const CONFIDENCE_TONE: Record<string, string> = {
  confirmed: "bg-tone-emerald-soft text-tone-emerald",
  "highly likely": "bg-tone-teal-soft text-tone-teal",
  probable: "bg-tone-blue-soft text-tone-blue",
  possible: "bg-tone-amber-soft text-tone-amber",
  uncertain: "bg-tone-rose-soft text-tone-rose",
};

type Answer = Awaited<ReturnType<typeof askFrancis>>;
type Turn = { id: string; question: string; answer: Answer };

/** Renders the model's markdown with FH numbers turned into record links. */
function AnswerBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const bullets = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (bullets)
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(/^\s*[-*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        if (/^#{1,4}\s/.test(block))
          return (
            <h3 key={i} className="font-display text-base font-semibold">
              {block.replace(/^#{1,4}\s/, "")}
            </h3>
          );
        return (
          <p key={i}>
            <Inline text={block} />
          </p>
        );
      })}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|FH\d{3,}|DS\d{3,})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part))
          return (
            <strong key={i}>
              <Inline text={part.slice(2, -2)} />
            </strong>
          );
        if (/^FH\d{3,}$/.test(part))
          return (
            <Link
              key={i}
              to="/letters/$archiveId"
              params={{ archiveId: part }}
              className="archive-id text-archive-gold underline-offset-2 hover:underline"
            >
              {part}
            </Link>
          );
        if (/^DS\d{3,}$/.test(part))
          return (
            <Link
              key={i}
              to="/sources/$dsId"
              params={{ dsId: part }}
              className="archive-id text-archive-gold underline-offset-2 hover:underline"
            >
              {part}
            </Link>
          );
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

type ShareRecord = { kind: "letter" | "source"; id: string; identifier: string; title?: string | null };

/**
 * Emails a research answer together with the FH / DS records it cited. The
 * records travel as unlisted archive links, exactly like a record email.
 */
function ShareAnswerButton({ turn }: { turn: Turn }) {
  const ids = turn.answer.citations.map((c) => c.archive_id).slice(0, 10);

  const { data: records, isLoading } = useQuery({
    queryKey: ["ask-share-records", ids.join(",")],
    queryFn: async (): Promise<ShareRecord[]> => {
      const fh = ids.filter((i) => !i.startsWith("DS"));
      const ds = ids.filter((i) => i.startsWith("DS"));
      const found = new Map<string, ShareRecord>();
      if (fh.length) {
        const { data } = await supabase.from("letters").select("id, archive_id, title").in("archive_id", fh);
        for (const r of data ?? [])
          found.set(r.archive_id as string, {
            kind: "letter",
            id: r.id as string,
            identifier: r.archive_id as string,
            title: (r.title as string | null) ?? null,
          });
      }
      if (ds.length) {
        const { data } = await supabase.from("digital_sources").select("id, ds_id, title").in("ds_id", ds);
        for (const r of data ?? [])
          found.set(r.ds_id as string, {
            kind: "source",
            id: r.id as string,
            identifier: r.ds_id as string,
            title: (r.title as string | null) ?? null,
          });
      }
      return ids.map((i) => found.get(i)).filter(Boolean) as ShareRecord[];
    },
  });

  const body = [
    `Research question: ${turn.question}`,
    "",
    turn.answer.answer,
    turn.answer.caveats ? `\nCaveats: ${turn.answer.caveats}` : "",
    `\nConfidence: ${turn.answer.confidence}`,
    ids.length ? `Supporting records: ${ids.join(", ")}` : "",
    "\nShared from Ask Francis — an AI research finding, not catalog fact.",
  ]
    .filter(Boolean)
    .join("\n");

  if (isLoading)
    return (
      <Button size="sm" className="gap-1.5" disabled>
        <Loader2 className="size-3.5 animate-spin" /> Share Results
      </Button>
    );

  return (
    <EmailArchiveDialog
      records={records ?? []}
      defaultSubject={`Research from The Francis Files: ${turn.question.slice(0, 120)}`}
      defaultMessage={body}
      description={
        (records ?? []).length > 0
          ? `Emails this research answer along with ${(records ?? []).map((r) => r.identifier).join(", ")}. Records travel as unlisted archive links you can switch off later.`
          : "Emails this research answer. No linked records were cited."
      }
      trigger={
        <Button size="sm" className="gap-1.5">
          <Share2 className="size-3.5" /> Share Results
        </Button>
      }
    />
  );
}



function AskFrancis() {
  const { canEdit, user, isGuestViewer, isAdmin } = useAuth();
  const qc = useQueryClient();
  const ask = useServerFn(askFrancis);
  const refresh = useServerFn(refreshResearchSnapshot);
  const [lens, setLens] = useState<LensKey>("answer");
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [claimFor, setClaimFor] = useState<Turn | null>(null);
  const [claimText, setClaimText] = useState("");
  const [claimConfidence, setClaimConfidence] = useState("probable");
  const [claimEvidence, setClaimEvidence] = useState("");
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const { data: snapshot } = useQuery({
    queryKey: ["research-snapshot-latest"],
    queryFn: async () => {
      const { data } = await supabase
        .from("research_snapshots")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as
        | {
            status: string;
            finished_at: string | null;
            started_at: string;
            folder: string | null;
            records_indexed: number;
            transcriptions_indexed: number;
            people_count: number;
            places_count: number;
            error: string | null;
          }
        | null;
    },
  });

  const { data: lastChange } = useQuery({
    queryKey: ["archive-last-change"],
    queryFn: async () => {
      const [{ data: l }, { data: t }] = await Promise.all([
        supabase.from("letters").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase
          .from("scan_transcriptions")
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const stamps = [l?.updated_at, t?.updated_at].filter(Boolean) as string[];
      return stamps.sort().at(-1) ?? null;
    },
  });

  const stale = useMemo(() => {
    if (!snapshot?.finished_at || !lastChange) return false;
    return new Date(lastChange) > new Date(snapshot.finished_at);
  }, [snapshot, lastChange]);

  async function run(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const history = thread.flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.answer.answer },
      ]);
      const answer = await ask({ data: { question: text, history } });
      setThread((prev) => [...prev, { id: crypto.randomUUID(), question: text, answer }]);
      setQuestion("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ask Francis could not answer that.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSnapshot() {
    setRefreshing(true);
    toast.info("Building a fresh Research Snapshot…");
    try {
      const result = await refresh({});
      if (result.status === "error") toast.error(`Snapshot failed: ${result.error}`);
      else
        toast.success(
          `Snapshot complete — ${result.records} records, ${result.transcriptions} transcriptions, ${result.files} files written.`,
        );
      qc.invalidateQueries({ queryKey: ["research-snapshot-latest"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Snapshot failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveNote(turn: Turn) {
    try {
      await postArchiveNote({
        title: `Research: ${turn.question.slice(0, 90)}`,
        body: `${turn.answer.answer}\n\nConfidence: ${turn.answer.confidence}\nSources: ${turn.answer.citations
          .map((c) => c.archive_id)
          .join(", ")}\n\n(Saved from Ask Francis — research finding, not catalog data.)`,
        authorId: user?.id,
        authorName: user?.email ?? null,
      });
      toast.success("Saved as a research note.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the note");
    }
  }

  function openClaim(turn: Turn) {
    setClaimFor(turn);
    setClaimText(turn.answer.answer.split("\n")[0] ?? "");
    setClaimConfidence(turn.answer.confidence);
    setClaimEvidence(turn.answer.citations.map((c) => c.archive_id).join(", "));
  }

  async function saveClaim() {
    if (!claimFor) return;
    const evidence = claimEvidence
      .split(/[,\s]+/)
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean);
    const { error } = await supabase.from("historical_claims").insert({
      claim: claimText.trim(),
      confidence: claimConfidence,
      question: claimFor.question,
      reasoning: claimFor.answer.answer,
      evidence,
      created_by: user?.id ?? null,
      created_by_name: user?.email ?? null,
    } as never);
    if (error) toast.error(error.message);
    else {
      toast.success("Historical claim recorded.");
      setClaimFor(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Ask Francis"
        description="Research the entire archive — every answer cites its FH records."
        center={
          <img
            src={askIcon}
            alt=""
            loading="lazy"
            width={512}
            height={512}
            className="size-24 shrink-0 object-contain sm:size-28"
          />
        }
        actions={
          canEdit ? (
            <Button variant="outline" className="gap-2" onClick={refreshSnapshot} disabled={refreshing}>
              {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh Research Snapshot
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6 p-4 sm:p-8">
        {/* ---- Research dataset status ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5">
              <Database className="size-3.5 text-archive-gold" />
              <span className="font-medium tabular-nums">{snapshot?.records_indexed ?? 0} records</span>
            </div>
            <span className="hidden h-4 w-px bg-border sm:inline" />
            <span className="text-muted-foreground">
              Snapshot: {" "}
              {snapshot?.finished_at
                ? new Date(snapshot.finished_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : snapshot
                  ? "In progress…"
                  : "Never"}
            </span>
            {snapshot?.status === "error" ? (
              <span className="rounded-full bg-tone-rose-soft px-2 py-0.5 text-xs font-medium text-tone-rose">
                Failed
              </span>
            ) : stale ? (
              <span className="rounded-full bg-tone-amber-soft px-2 py-0.5 text-xs font-medium text-tone-amber">
                Stale
              </span>
            ) : (
              <span className="rounded-full bg-tone-emerald-soft px-2 py-0.5 text-xs font-medium text-tone-emerald">
                Current
              </span>
            )}
          </div>
          {canEdit && (
            <Button size="sm" variant="ghost" className="gap-1.5 rounded-full" onClick={refreshSnapshot} disabled={refreshing}>
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </Button>
          )}
        </div>

        {/* ---- Question box ---- */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Textarea
            ref={boxRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(question);
            }}
            placeholder="Ask a question about the Francis Archive…"
            className="min-h-28 resize-y text-base"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {LENSES.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLens(l.key)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    lens === l.key
                      ? "bg-tone-blue-soft text-tone-blue"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <Button className="gap-2" onClick={() => run(question)} disabled={busy || !question.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Ask Francis
            </Button>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <p className="field-label mb-2">Try a research question</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setQuestion(ex);
                    boxRef.current?.focus();
                  }}
                  className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-archive-gold/50 hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Lens views ---- */}
        {lens !== "answer" && <LensPanel lens={lens} />}

        {/* ---- Thread ---- */}
        {lens === "answer" && busy && (
          <p className="text-sm text-muted-foreground">
            Searching the research index and reading the supporting records…
          </p>
        )}

        {(lens === "answer" ? thread : [])
          .slice()
          .reverse()
          .map((turn) => (
            <div key={turn.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="font-display text-lg font-semibold">{turn.question}</p>
              <div className="mt-2 mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                    CONFIDENCE_TONE[turn.answer.confidence] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {turn.answer.confidence}
                </span>
                <span className="text-xs text-muted-foreground">
                  {turn.answer.evidence.length} records retrieved · AI interpretation, not catalog fact
                </span>
              </div>

              <AnswerBody text={turn.answer.answer} />

              {turn.answer.caveats && (
                <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <strong>Caveats:</strong> {turn.answer.caveats}
                </p>
              )}

              {turn.answer.citations.length > 0 && (
                <div className="mt-4">
                  <p className="field-label mb-2">Supporting records</p>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {turn.answer.citations.map((c) => (
                      <Link
                        key={c.archive_id}
                        to={c.archive_id.startsWith("DS") ? "/sources/$dsId" : "/letters/$archiveId"}
                        params={
                          c.archive_id.startsWith("DS")
                            ? ({ dsId: c.archive_id } as never)
                            : ({ archiveId: c.archive_id } as never)
                        }
                        className="flex items-start gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
                      >
                        <FileStack className="mt-0.5 size-4 shrink-0 text-archive-gold" />
                        <span className="archive-id w-24 shrink-0">{c.archive_id}</span>
                        <span className="text-muted-foreground">{c.note}</span>
                        {c.confidence && (
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground capitalize">
                            {c.confidence}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {turn.answer.follow_ups.length > 0 && (
                <div className="mt-4">
                  <p className="field-label mb-2">Ask follow-up</p>
                  <div className="flex flex-wrap gap-2">
                    {turn.answer.follow_ups.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => run(f)}
                        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-archive-gold/50"
                      >
                        <CornerDownRight className="size-3" /> {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setQuestion(`Following up on "${turn.question}": `);
                    boxRef.current?.focus();
                  }}
                >
                  <CornerDownRight className="size-3.5" /> Ask Follow-Up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    navigator.clipboard.writeText(turn.answer.answer);
                    toast.success("Response copied.");
                  }}
                >
                  <Copy className="size-3.5" /> Copy Response
                </Button>
                {!isGuestViewer && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => saveNote(turn)}>
                      <NotebookPen className="size-3.5" /> Save as Research Note
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openClaim(turn)}>
                      <Gavel className="size-3.5" /> Create Historical Claim
                    </Button>
                  </>
                )}
                {isAdmin && <div className="ml-auto"><ShareAnswerButton turn={turn} /></div>}
              </div>

            </div>
          ))}

        {!thread.length && !busy && (
          <p className="text-sm text-muted-foreground">
            Ask Francis reads the whole archive — catalog fields, transcriptions, OCR, summaries, notes and
            keywords — then answers with the FH records that support it. Findings stay research findings until
            you save them.
          </p>
        )}
      </div>

      <Dialog open={Boolean(claimFor)} onOpenChange={(open) => !open && setClaimFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create historical claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="field-label mb-1">Claim</p>
              <Textarea value={claimText} onChange={(e) => setClaimText(e.target.value)} className="min-h-24" />
            </div>
            <div>
              <p className="field-label mb-1">Confidence</p>
              <Select value={claimConfidence} onValueChange={setClaimConfidence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["confirmed", "highly likely", "probable", "possible", "uncertain"].map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="field-label mb-1">Evidence (FH numbers)</p>
              <Input value={claimEvidence} onChange={(e) => setClaimEvidence(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Claims are stored as research findings. They never change catalog data.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimFor(null)}>
              Cancel
            </Button>
            <Button onClick={saveClaim} disabled={!claimText.trim()}>
              Save claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
