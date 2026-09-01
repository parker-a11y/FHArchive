import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transcribeRecord } from "@/lib/transcription.functions";
import { AdminOnly, AppShell, PageHeader } from "@/components/AppShell";
import { fetchLetters, type Letter } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { ToneBackfillCard } from "@/components/ai/ToneBackfillCard";
import { displayDate, isUnidentifiedPhoto, needsDating } from "@/lib/archive";

export const Route = createFileRoute("/_authenticated/queues")({
  head: () => ({
    meta: [
      { title: "Work Queues — The Francis Files" },
      {
        name: "description",
        content:
          "Workflow queues showing letters that still need scanning, transcription, review or research.",
      },
      { property: "og:title", content: "Work Queues — The Francis Files" },
      {
        property: "og:description",
        content: "See exactly what archival work remains across the collection.",
      },
    ],
  }),
  component: () => (
    <AdminOnly>
      <AppShell>
        <Queues />
      </AppShell>
    </AdminOnly>
  ),
});

function Queues() {
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const { data: pendingAi = [] } = useQuery({
    queryKey: ["ai_pending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_suggestions")
        .select("letter_id")
        .eq("status", "pending");
      return (data ?? []).map((r) => r.letter_id as string);
    },
  });

  const dig = (l: Letter) => l.digitization_status ?? "not_scanned";

  const queues: { key: string; label: string; fn: (l: Letter) => boolean }[] = [
    { key: "not_scanned", label: "Not Scanned", fn: (l) => dig(l) === "not_scanned" },
    {
      key: "scanning",
      label: "Scanning / In Progress",
      fn: (l) => dig(l) === "in_progress",
    },
    {
      key: "scan_review",
      label: "Scanned — Needs Review",
      fn: (l) => dig(l) === "needs_review",
    },
    {
      key: "digitized",
      label: "Digitization Complete",
      fn: (l) => dig(l) === "complete",
    },
    { key: "undated", label: "Undated / Needs Dating", fn: needsDating },
    { key: "unidphoto", label: "Unidentified Photos", fn: isUnidentifiedPhoto },
    { key: "scan", label: "Needs Scanning (legacy scans)", fn: (l) => l.image_count === 0 },
    {
      key: "transcribe",
      label: "Needs Transcription",
      fn: (l) =>
        l.transcription_status === "not_started" && l.image_count > 0,
    },
    {
      key: "review",
      label: "Needs Review",
      fn: (l) =>
        l.transcription_status !== "not_required" &&
        (l.transcription_status === "needs_review" ||
          l.transcription_status === "ai_transcribed" ||
          l.review_status === "not_reviewed"),
    },
    {
      key: "unidentified",
      label: "Unidentified Material",
      fn: (l) =>
        (l.identification_status ?? "unidentified") === "unidentified" ||
        (l.identification_status ?? "") === "needs_research",
    },
    {
      key: "meta",
      label: "Missing Metadata",
      fn: (l) => !l.title && !l.author && !l.origin && !l.normalized_date,
    },
    {
      key: "ai",
      label: "AI Suggestions Awaiting Review",
      fn: (l) => pendingAi.includes(l.id),
    },
    { key: "research", label: "Research Needed", fn: (l) => l.research_needed },
    {
      key: "done",
      label: "Completed",
      fn: (l) =>
        l.image_count > 0 &&
        (l.transcription_status === "human_verified" || l.transcription_status === "not_required") &&
        l.review_status === "reviewed",
    },
  ];

  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState<{ done: number; total: number; failed: number } | null>(null);

  /** Queued batch transcription: records are processed one at a time and a
   * failure never stops the queue or touches the archival scans. */
  async function transcribeSelected(ids: string[]) {
    if (!ids.length) return;
    setBatch({ done: 0, total: ids.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        const r = await transcribeRecord({ data: { letterId: ids[i], force: false } });
        if (r.error || r.failed) {
          failed += 1;
          toast.error(`${r.error ?? `${r.failed} page(s) failed`}`);
        }
      } catch (e) {
        failed += 1;
        toast.error((e as Error).message);
      }
      setBatch({ done: i + 1, total: ids.length, failed });
    }
    setBatch(null);
    setSelected([]);
    qc.invalidateQueries({ queryKey: ["letters"] });
    toast.success(`Batch finished — ${ids.length - failed} of ${ids.length} records transcribed`);
  }

  const [active, setActive] = useState("not_scanned");
  const current = queues.find((q) => q.key === active)!;
  const rows = letters.filter(current.fn);

  return (
    <>
      <PageHeader title="Work Queues" description="What remains to be done." />
      <div className="px-4 pt-4 sm:px-8">
        <ToneBackfillCard letters={letters} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-8 p-4 sm:p-8">
        <nav className="space-y-1">
          {queues.map((q) => (
            <button
              key={q.key}
              onClick={() => setActive(q.key)}
              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                active === q.key ? "bg-secondary font-medium" : "hover:bg-muted"
              }`}
            >
              {q.label}
              <span className="tabular-nums text-muted-foreground">
                {letters.filter(q.fn).length}
              </span>
            </button>
          ))}
        </nav>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="field-label">
              {current.label} — {rows.length}
            </h2>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected.length || !!batch}
              onClick={() => transcribeSelected(selected)}
            >
              {batch ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 size-3.5" />
              )}
              Transcribe Selected ({selected.length})
            </Button>
            {rows.length > 0 && (
              <button
                className="text-xs text-muted-foreground underline"
                onClick={() =>
                  setSelected(selected.length ? [] : rows.map((l) => l.id))
                }
              >
                {selected.length ? "Clear" : "Select all in queue"}
              </button>
            )}
            {batch && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {batch.done} / {batch.total} records · {batch.failed} failed
              </span>
            )}
          </div>
          <div className="divide-y divide-border rounded border border-border bg-card">
            {rows.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 hover:bg-muted/60">
                <input
                  type="checkbox"
                  checked={selected.includes(l.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...new Set([...s, l.id])] : s.filter((x) => x !== l.id),
                    )
                  }
                />
              <Link
                to="/letters/$archiveId"
                params={{ archiveId: l.archive_id }}
                className="flex flex-1 items-center gap-6 py-2 text-sm"
              >
                <span className="archive-id w-28 text-primary">{l.archive_id}</span>
                <span className="w-40 text-muted-foreground">{displayDate(l)}</span>
                <span className="truncate">
                  {l.title || (l.author || l.recipient ? `${l.author || "—"} → ${l.recipient || "—"}` : "—")}
                </span>
              </Link>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">Queue is empty.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
