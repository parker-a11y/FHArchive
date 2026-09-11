import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FfnText } from "@/components/ffn/FfnText";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, MessageSquareText, AlertTriangle } from "lucide-react";
import { AppShell, AdminOnly, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/ask-history")({
  head: () => ({
    meta: [
      { title: "Ask Francis History — The Francis Files" },
      { name: "description", content: "Admin review of past Ask Francis research questions and answers." },
    ],
  }),
  component: () => (
    <AppShell>
      <AdminOnly>
        <AskHistory />
      </AdminOnly>
    </AppShell>
  ),
});

type QueryRow = {
  id: string;
  user_email: string | null;
  user_name: string | null;
  question: string;
  answer: string | null;
  confidence: string | null;
  citations: { archive_id: string; note?: string }[];
  sources: { title?: string; url: string; note?: string }[] | null;
  corpus: { total: number; full: number; condensed: number } | null;

  model: string | null;
  error: string | null;
  created_at: string;
};

const CONFIDENCE_TONE: Record<string, string> = {
  confirmed: "bg-tone-emerald-soft text-tone-emerald",
  "highly likely": "bg-tone-teal-soft text-tone-teal",
  probable: "bg-tone-blue-soft text-tone-blue",
  possible: "bg-tone-amber-soft text-tone-amber",
  uncertain: "bg-tone-rose-soft text-tone-rose",
};

function AskHistory() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["ask-francis-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ask_francis_queries")
        .select(
          "id, user_email, user_name, question, answer, confidence, citations, sources, corpus, model, error, created_at",
        )

        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as QueryRow[];
    },
  });

  const filtered = (rows ?? []).filter((r) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      r.question.toLowerCase().includes(needle) ||
      (r.user_email ?? "").toLowerCase().includes(needle) ||
      (r.user_name ?? "").toLowerCase().includes(needle) ||
      (r.answer ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <>
      <PageHeader
        title="Ask Francis History"
        description="Every research question asked through Ask Francis — who asked, when, and what the answer was."
      />
      <div className="space-y-4 p-4 sm:p-8">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by question, person, or answer text…"
          className="max-w-md"
        />

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading history…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {rows?.length ? "No questions match that filter." : "No Ask Francis questions logged yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const isOpen = open === r.id;
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <MessageSquareText className="mt-0.5 size-4 shrink-0 text-archive-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{r.question}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.user_name || r.user_email || "Unknown user"} ·{" "}
                        {new Date(r.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {r.model ? ` · ${r.model}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.error ? (
                        <span className="rounded-full bg-tone-rose-soft px-2 py-0.5 text-xs font-medium text-tone-rose">
                          Failed
                        </span>
                      ) : r.confidence ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CONFIDENCE_TONE[r.confidence] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {r.confidence}
                        </span>
                      ) : null}
                      <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-4 py-3">
                      {r.error ? (
                        <p className="flex items-center gap-2 text-sm text-tone-rose">
                          <AlertTriangle className="size-4" /> {r.error}
                        </p>
                      ) : (
                        <>
                          {r.corpus && (
                            <p className="mb-2 text-xs text-muted-foreground">
                              All {r.corpus.total} records searched · {r.corpus.full} read in full
                              {r.corpus.condensed ? ` · ${r.corpus.condensed} condensed` : ""}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap text-sm leading-relaxed"><FfnText text={r.answer ?? ""} /></p>
                          {r.citations.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {r.citations.map((c) =>
                                c.archive_id.startsWith("DS") ? (
                                  <Link
                                    key={c.archive_id}
                                    to="/sources/$dsId"
                                    params={{ dsId: c.archive_id }}
                                    className="archive-id rounded-full border border-border px-2 py-0.5 text-xs text-archive-gold hover:underline"
                                  >
                                    {c.archive_id}
                                  </Link>
                                ) : (
                                  <Link
                                    key={c.archive_id}
                                    to="/letters/$archiveId"
                                    params={{ archiveId: c.archive_id }}
                                    className="archive-id rounded-full border border-border px-2 py-0.5 text-xs text-archive-gold hover:underline"
                                  >
                                    {c.archive_id}
                                  </Link>
                                ),
                              )}
                            </div>
                          )}
                          {(r.sources?.length ?? 0) > 0 && (
                            <div className="mt-3">
                              <p className="field-label mb-1">Outside sources</p>
                              <ul className="space-y-1">
                                {r.sources!.map((s) => (
                                  <li key={s.url} className="text-xs">
                                    <a
                                      href={s.url}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="text-archive-gold hover:underline"
                                    >
                                      {s.title || s.url}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
