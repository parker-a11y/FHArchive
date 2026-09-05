import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Pencil, Check, ExternalLink } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RecapBody } from "@/components/RecapBody";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  ISO_DATE,
  fetchArchiveOnDate,
  fetchNeighborArchiveDates,
  prettyDate,
  shiftDay,
  shortDate,
  type DateContext,
} from "@/lib/on-this-date";
import {
  getDateContextFn,
  regenerateDateContextFn,
  saveDateContextFn,
  setDateReviewedFn,
} from "@/lib/on-this-date.functions";

export const Route = createFileRoute("/_authenticated/on-this-date/$date")({
  head: ({ params }) => ({
    meta: [
      { title: `On This Date — ${params.date} — The Francis Files` },
      {
        name: "description",
        content:
          "One day in the Francis Harrington Archive: the letters, photographs and documents created that day, and what was happening in the wider world.",
      },
      { property: "og:title", content: `On This Date — ${params.date}` },
      {
        property: "og:description",
        content: "A window onto one particular day in the past, from the Francis Harrington Archive.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <OnThisDate />
    </AppShell>
  ),
});

function OnThisDate() {
  const { date } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { canEdit } = useAuth();
  const valid = ISO_DATE.test(date);

  const archive = useQuery({
    queryKey: ["otd_archive", date],
    queryFn: () => fetchArchiveOnDate(date),
    enabled: valid,
  });
  const neighbors = useQuery({
    queryKey: ["otd_neighbors", date],
    queryFn: () => fetchNeighborArchiveDates(date),
    enabled: valid,
  });
  const context = useQuery({
    queryKey: ["otd_context", date],
    queryFn: async () => (await getDateContextFn({ data: { date } })) as unknown as DateContext,
    enabled: valid,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => setEditing(false), [date]);

  const regenerate = useMutation({
    mutationFn: async () => regenerateDateContextFn({ data: { date } }),
    onSuccess: (row) => {
      qc.setQueryData(["otd_context", date], row);
      toast.success("Historical context regenerated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: async () =>
      saveDateContextFn({
        data: { date, narrative_md: draft, sources: context.data?.sources ?? [] },
      }),
    onSuccess: (row) => {
      qc.setQueryData(["otd_context", date], row);
      setEditing(false);
      toast.success("Saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const review = useMutation({
    mutationFn: async (reviewed: boolean) => setDateReviewedFn({ data: { date, reviewed } }),
    onSuccess: (row) => qc.setQueryData(["otd_context", date], row),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!valid)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        That is not a valid date. <Link to="/" className="text-primary underline">Back to the dashboard</Link>
      </div>
    );

  const ctx = context.data;
  const records = archive.data?.records ?? [];
  const sources = archive.data?.sources ?? [];
  const events = archive.data?.events ?? [];

  return (
    <>
      <PageHeader
        title="On This Date"
        description={prettyDate(date)}
        action={
          <Button variant="outline" size="sm" onClick={() => router.history.back()}>
            <ArrowLeft className="mr-1 size-4" /> Back
          </Button>
        }
      />

      <div className="mx-auto max-w-3xl space-y-10 p-4 sm:p-8">
        {/* ------------------------------------------------ archive activity */}
        <section>
          <h2 className="font-display text-xl font-semibold tracking-tight">In the Francis Archive</h2>
          <p className="mt-1 text-sm text-muted-foreground">{prettyDate(date)}</p>

          <div className="mt-4 space-y-3">
            {records.map((r) => (
              <Link
                key={r.id}
                to="/letters/$archiveId"
                params={{ archiveId: r.archive_id }}
                className="block rounded-lg border border-border bg-card p-4 transition hover:border-primary hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="archive-id text-sm text-primary">{r.archive_id}</span>
                  <span className="font-medium">
                    {r.title || `${r.record_type}${r.subtype ? ` · ${r.subtype}` : ""}`}
                  </span>
                  {r.date_from_postmark && (
                    <span className="text-xs text-muted-foreground">Postmark date</span>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[r.author && `From ${r.author}`, r.recipient && `to ${r.recipient}`, r.origin, r.destination]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                {r.summary_short && <p className="mt-2 text-sm">{r.summary_short}</p>}
              </Link>
            ))}

            {sources.map((s) => (
              <Link
                key={s.id}
                to="/sources/$dsId"
                params={{ dsId: s.ds_id }}
                className="block rounded-lg border border-border bg-card p-4 transition hover:border-primary hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="archive-id text-sm text-archive-gold">{s.ds_id}</span>
                  <span className="font-medium">{s.title}</span>
                </div>
                {s.institution && (
                  <div className="mt-1 text-sm text-muted-foreground">{s.institution}</div>
                )}
              </Link>
            ))}

            {!records.length && !sources.length && (
              <p className="text-sm text-muted-foreground">
                The archive holds no record dated this day.
              </p>
            )}
          </div>

          {events.length > 0 && (
            <div className="mt-5">
              <h3 className="field-label">Archive events spanning this date</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {events.map((e) => (
                  <li key={e.id}>
                    <span className="font-medium">{e.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {e.start_date ? shortDate(e.start_date) : "—"}
                      {e.end_date ? ` – ${shortDate(e.end_date)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* -------------------------------------------------- world context */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-archive-rule pb-2">
            <h2 className="font-display text-xl font-semibold tracking-tight">The World on This Date</h2>
            {canEdit && ctx && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(ctx.narrative_md);
                    setEditing((v) => !v);
                  }}
                >
                  <Pencil className="mr-1 size-4" /> {editing ? "Cancel" : "Edit"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={regenerate.isPending}
                  onClick={() => {
                    if (
                      ctx.manually_edited &&
                      !window.confirm("This narrative was edited by hand. Regenerating will replace those edits. Continue?")
                    )
                      return;
                    regenerate.mutate();
                  }}
                >
                  {regenerate.isPending ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 size-4" />
                  )}
                  Regenerate
                </Button>
                <Button
                  variant={ctx.reviewed ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => review.mutate(!ctx.reviewed)}
                >
                  <Check className="mr-1 size-4" /> {ctx.reviewed ? "Reviewed" : "Mark reviewed"}
                </Button>
              </div>
            )}
          </div>

          {context.isLoading && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Researching this day…
            </p>
          )}
          {context.isError && (
            <p className="mt-4 text-sm text-destructive">
              {(context.error as Error).message}
            </p>
          )}

          {ctx && !editing && (
            <article className="mt-4">
              <RecapBody text={ctx.narrative_md} />
            </article>
          )}

          {ctx && editing && (
            <div className="mt-4 space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[320px] font-mono text-sm"
              />
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Save narrative
              </Button>
            </div>
          )}

          {ctx && ctx.sources?.length > 0 && (
            <details className="mt-6 text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Sources / Learn More
              </summary>
              <ul className="mt-2 space-y-1">
                {ctx.sources.map((s, i) => (
                  <li key={i}>
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary hover:underline"
                      >
                        {s.title}
                        <ExternalLink className="ml-1 inline size-3" />
                      </a>
                    ) : (
                      <span>{s.title}</span>
                    )}
                    {s.publisher && <span className="text-muted-foreground"> · {s.publisher}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {canEdit && ctx && (
            <p className="mt-4 text-xs text-muted-foreground">
              Generated {new Date(ctx.generated_at).toLocaleString()}
              {ctx.last_edited_at ? ` · edited ${new Date(ctx.last_edited_at).toLocaleString()}` : ""}
              {ctx.regenerated_count ? ` · regenerated ${ctx.regenerated_count}×` : ""}
              {` · ${ctx.view_count} view${ctx.view_count === 1 ? "" : "s"}`}
              {ctx.reviewed ? " · reviewed" : " · not reviewed"}
              {ctx.manually_edited ? " · manually edited" : ""}
            </p>
          )}
        </section>

        {/* ------------------------------------------------------ navigation */}
        <nav className="flex flex-col gap-3 border-t border-border pt-6 text-sm">
          <div className="flex items-center justify-between">
            <Link
              to="/on-this-date/$date"
              params={{ date: shiftDay(date, -1) }}
              className="text-primary hover:underline"
            >
              ← Previous day
            </Link>
            <Link
              to="/on-this-date/$date"
              params={{ date: shiftDay(date, 1) }}
              className="text-primary hover:underline"
            >
              Next day →
            </Link>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            {neighbors.data?.prev ? (
              <Link
                to="/on-this-date/$date"
                params={{ date: neighbors.data.prev }}
                className="inline-flex items-center gap-1 hover:text-primary hover:underline"
              >
                <ArrowLeft className="size-3" /> Previous archive date · {shortDate(neighbors.data.prev)}
              </Link>
            ) : (
              <span>No earlier archive date</span>
            )}
            {neighbors.data?.next ? (
              <Link
                to="/on-this-date/$date"
                params={{ date: neighbors.data.next }}
                className="inline-flex items-center gap-1 hover:text-primary hover:underline"
              >
                Next archive date · {shortDate(neighbors.data.next)} <ArrowRight className="size-3" />
              </Link>
            ) : (
              <span>No later archive date</span>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
