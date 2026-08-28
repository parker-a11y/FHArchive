import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { fetchLetters, type Letter } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { displayDate, isUnidentifiedPhoto, needsDating } from "@/lib/archive";

export const Route = createFileRoute("/queues")({
  head: () => ({
    meta: [
      { title: "Work Queues — Harrington Letter Archive" },
      {
        name: "description",
        content:
          "Workflow queues showing letters that still need scanning, transcription, review or research.",
      },
      { property: "og:title", content: "Work Queues — Harrington Letter Archive" },
      {
        property: "og:description",
        content: "See exactly what archival work remains across the collection.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Queues />
    </AppShell>
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

  const queues: { key: string; label: string; fn: (l: Letter) => boolean }[] = [
    { key: "undated", label: "Undated / Needs Dating", fn: needsDating },
    { key: "unidphoto", label: "Unidentified Photos", fn: isUnidentifiedPhoto },
    { key: "scan", label: "Needs Scanning", fn: (l) => l.image_count === 0 },
    {
      key: "transcribe",
      label: "Needs Transcription",
      fn: (l) => l.transcription_status === "not_started" && l.image_count > 0,
    },
    {
      key: "review",
      label: "Needs Review",
      fn: (l) =>
        l.transcription_status === "needs_review" ||
        l.transcription_status === "ai_transcribed" ||
        l.review_status === "not_reviewed",
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
        l.transcription_status === "human_verified" &&
        l.review_status === "reviewed",
    },
  ];

  const [active, setActive] = useState("scan");
  const current = queues.find((q) => q.key === active)!;
  const rows = letters.filter(current.fn);

  return (
    <>
      <PageHeader title="Work Queues" description="What remains to be done." />
      <div className="grid grid-cols-[16rem_1fr] gap-8 p-8">
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
          <h2 className="field-label mb-3">
            {current.label} — {rows.length}
          </h2>
          <div className="divide-y divide-border rounded border border-border bg-card">
            {rows.map((l) => (
              <Link
                key={l.id}
                to="/letters/$archiveId"
                params={{ archiveId: l.archive_id }}
                className="flex items-center gap-6 px-4 py-2 text-sm hover:bg-muted/60"
              >
                <span className="archive-id w-28 text-primary">{l.archive_id}</span>
                <span className="w-40 text-muted-foreground">{displayDate(l)}</span>
                <span className="truncate">
                  {l.title || (l.author || l.recipient ? `${l.author || "—"} → ${l.recipient || "—"}` : "—")}
                </span>
              </Link>
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
