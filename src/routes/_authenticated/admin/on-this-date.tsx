import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { fetchDateContexts, prettyDate } from "@/lib/on-this-date";
import {
  enqueueMissingDatesFn,
  getBackfillStatusFn,
  retryQueuedDateFn,
  setBackfillPausedFn,
} from "@/lib/on-this-date.functions";

export const Route = createFileRoute("/_authenticated/admin/on-this-date")({
  head: () => ({
    meta: [
      { title: "On This Date Review — The Francis Files" },
      {
        name: "description",
        content:
          "Editorial dashboard for the historical narratives readers have generated across the Francis Harrington Archive.",
      },
      { property: "og:title", content: "On This Date Review" },
      { property: "og:description", content: "Editorial oversight for archive historical context." },
    ],
  }),
  component: () => (
    <AppShell>
      <OnThisDateReview />
    </AppShell>
  ),
});

const FILTERS = [
  { value: "all", label: "All dates" },
  { value: "unreviewed", label: "Not reviewed" },
  { value: "reviewed", label: "Reviewed" },
  { value: "edited", label: "Manually edited" },
  { value: "regenerated", label: "Regenerated" },
] as const;

const SORTS = [
  { value: "generated", label: "Recently generated" },
  { value: "viewed", label: "Most recently viewed" },
  { value: "views", label: "Most frequently viewed" },
] as const;

function OnThisDateReview() {
  const { loading, canEdit } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !canEdit) navigate({ to: "/", replace: true });
  }, [loading, canEdit, navigate]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["date_contexts"],
    queryFn: fetchDateContexts,
    enabled: canEdit,
  });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("generated");

  const rows = useMemo(() => {
    const filtered = data.filter((d) => {
      if (filter === "unreviewed") return !d.reviewed;
      if (filter === "reviewed") return d.reviewed;
      if (filter === "edited") return d.manually_edited;
      if (filter === "regenerated") return d.regenerated_count > 0;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "views") return b.view_count - a.view_count;
      if (sort === "viewed")
        return (b.last_viewed_at ?? "").localeCompare(a.last_viewed_at ?? "");
      return b.generated_at.localeCompare(a.generated_at);
    });
  }, [data, filter, sort]);

  if (!canEdit) return null;

  return (
    <>
      <PageHeader
        title="On This Date Review"
        description="Historical narratives readers have generated. Reviewing is optional — every narrative is already visible to guests."
      />
      <BackfillProgress />
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-8">
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 sm:p-8">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No historical context has been generated yet. It appears here the first time someone
            opens a date.
          </p>
        )}
        <div className="space-y-2">
          {rows.map((d) => (
            <Link
              key={d.id}
              to="/on-this-date/$date"
              params={{ date: d.on_date }}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-card p-3 hover:border-primary hover:bg-muted/40"
            >
              <span className="font-medium">{prettyDate(d.on_date)}</span>
              <span className="text-xs text-muted-foreground">
                Generated {new Date(d.generated_at).toLocaleDateString()}
                {" · "}
                {d.reviewed ? "Reviewed" : "Not reviewed"}
                {d.manually_edited ? " · Manually edited" : ""}
                {d.regenerated_count ? ` · Regenerated ${d.regenerated_count}×` : ""}
                {` · ${d.view_count} view${d.view_count === 1 ? "" : "s"}`}
                {d.last_viewed_at
                  ? ` · last viewed ${new Date(d.last_viewed_at).toLocaleDateString()}`
                  : ""}
                {d.last_edited_at
                  ? ` · edited ${new Date(d.last_edited_at).toLocaleDateString()}`
                  : ""}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

/** Progress of the slow background filling of every archive date. */
function BackfillProgress() {
  const qc = useQueryClient();
  const status = useServerFn(getBackfillStatusFn);
  const enqueue = useServerFn(enqueueMissingDatesFn);
  const setPaused = useServerFn(setBackfillPausedFn);
  const retry = useServerFn(retryQueuedDateFn);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["date_context_backfill"],
    queryFn: () => status({ data: undefined as never }),
    refetchInterval: 30_000,
  });

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["date_context_backfill"] });
      await qc.invalidateQueries({ queryKey: ["date_contexts"] });
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return null;
  const totalDays = data.written + data.pending;

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-3 text-sm sm:px-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          <strong>{data.written}</strong> of {totalDays} days written
          {data.pending > 0
            ? ` — ${data.pending} waiting, ${data.paused ? "paused" : "filling about 3 an hour"}`
            : " — all caught up"}
          {data.failed > 0 ? ` · ${data.failed} need attention` : ""}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(
                () => setPaused({ data: { paused: !data.paused } }),
                data.paused ? "Filling resumed." : "Filling paused.",
              )
            }
          >
            {data.paused ? "Resume" : "Pause"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(() => enqueue({ data: undefined as never }), "Waiting list updated.")
            }
          >
            Add missing days
          </Button>
        </div>
      </div>

      {data.errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.errors.map((e) => (
            <div key={e.on_date} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{prettyDate(e.on_date)}</span>
              <span className="text-muted-foreground">{e.last_error}</span>
              <button
                className="underline hover:text-primary"
                disabled={busy}
                onClick={() => run(() => retry({ data: { date: e.on_date } }), "Put back in line.")}
              >
                Try again
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
