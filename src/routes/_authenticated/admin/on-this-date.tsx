import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { fetchDateContexts, prettyDate } from "@/lib/on-this-date";

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
