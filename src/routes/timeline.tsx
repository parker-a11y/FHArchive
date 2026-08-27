import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { fetchLetters } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { PERIODS, displayDate } from "@/lib/archive";

export const Route = createFileRoute("/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — Harrington Letter Archive" },
      {
        name: "description",
        content:
          "Chronological timeline of the Harrington letters with period, person, place and keyword filters.",
      },
      { property: "og:title", content: "Timeline — Harrington Letter Archive" },
      {
        property: "og:description",
        content: "Chronological view of the family letter correspondence.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Timeline />
    </AppShell>
  ),
});

function Timeline() {
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const { data: links = [] } = useQuery({
    queryKey: ["timeline_links"],
    queryFn: async () => {
      const [k, p, pl] = await Promise.all([
        supabase.from("letter_keywords").select("letter_id, keywords(name)"),
        supabase.from("letter_people").select("letter_id, people(name)"),
        supabase.from("letter_places").select("letter_id, places(canonical_name)"),
      ]);
      const map: Record<string, string[]> = {};
      const push = (id: string, v?: string | null) => v && (map[id] ??= []).push(v);
      (k.data ?? []).forEach((r) => push(r.letter_id, r.keywords?.name));
      (p.data ?? []).forEach((r) => push(r.letter_id, r.people?.name));
      (pl.data ?? []).forEach((r) => push(r.letter_id, r.places?.canonical_name));
      return [map] as Record<string, string[]>[];
    },
  });
  const tagMap = links[0] ?? {};

  const [period, setPeriod] = useState("");
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    return letters
      .filter((l) => (period ? l.period === period : true))
      .filter((l) =>
        filter
          ? [l.author, l.recipient, l.origin, ...(tagMap[l.id] ?? [])]
              .join(" ")
              .toLowerCase()
              .includes(filter.toLowerCase())
          : true,
      )
      .sort((a, b) => {
        if (!a.normalized_date) return 1;
        if (!b.normalized_date) return -1;
        return a.normalized_date < b.normalized_date ? -1 : 1;
      });
  }, [letters, period, filter, tagMap]);

  let lastYear = "";

  return (
    <>
      <PageHeader title="Timeline" description={`${rows.length} letters in chronological order`} />
      <div className="flex gap-2 border-b border-border px-8 py-3">
        <Input
          className="h-8 w-72"
          placeholder="Filter by person, place or keyword…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="">All periods</option>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="max-w-4xl p-8">
        {rows.map((l) => {
          const year = l.normalized_date?.slice(0, 4) ?? "Undated";
          const showYear = year !== lastYear;
          lastYear = year;
          return (
            <div key={l.id}>
              {showYear && (
                <h2 className="font-display mt-8 mb-3 border-b border-archive-rule pb-1 text-lg font-semibold first:mt-0">
                  {year}
                </h2>
              )}
              <Link
                to="/letters/$archiveId"
                params={{ archiveId: l.archive_id }}
                className="block border-l-2 border-border py-2 pl-4 hover:border-primary hover:bg-muted/50"
              >
                <div className="flex items-baseline gap-4">
                  <span className="archive-id text-sm text-primary">{l.archive_id}</span>
                  <span className="text-sm font-medium">{displayDate(l)}</span>
                  <span className="text-sm text-muted-foreground">
                    {l.author || "—"} → {l.recipient || "—"}
                  </span>
                  {l.origin && <span className="text-sm text-muted-foreground">· {l.origin}</span>}
                </div>
                {l.summary_short && (
                  <p className="mt-1 text-sm text-muted-foreground">{l.summary_short}</p>
                )}
              </Link>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No letters yet.</p>}
      </div>
    </>
  );
}
