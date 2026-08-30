import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Globe, Hash } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { FffBadge, FFF_NAME, FFF_PLURAL, FFF_SHORT } from "@/components/FffBadge";
import { StarToggle } from "@/components/StarToggle";
import { Button } from "@/components/ui/button";
import { searchLetters, type Letter } from "@/lib/queries";
import { fetchSources, type DigitalSource } from "@/lib/sources";

export const Route = createFileRoute("/_authenticated/fff")({
  head: () => ({
    meta: [
      { title: "FFF — Francis File Find" },
      {
        name: "description",
        content:
          "Francis File Finds: the headline discoveries of The Francis Files — the records and digital sources flagged as most remarkable.",
      },
      { property: "og:title", content: "FFF — Francis File Find" },
      {
        property: "og:description",
        content: "The headline discoveries of The Francis Files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <FffPage />
    </AppShell>
  ),
});

type Kind = "all" | "records" | "sources";
type Sort = "added" | "date" | "id";

function dateOf(l: Letter) {
  return l.date_as_written || l.normalized_date || "";
}

function FffPage() {
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<Sort>("added");

  const { data: letterPage } = useQuery({
    queryKey: ["letters-page", "fff"],
    queryFn: () => searchLetters({ starred: true, limit: 500, sort: "fh_seq", dir: "desc" }),
  });
  const { data: sources = [] } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });

  const letters = useMemo(() => letterPage?.rows ?? [], [letterPage]);
  const starredSources = useMemo(
    () => (sources as DigitalSource[]).filter((s) => Boolean(s.starred)),
    [sources],
  );

  const items = useMemo(() => {
    type Item = {
      key: string;
      kind: "letter" | "source";
      id: string;
      identifier: string;
      seq: number;
      title: string;
      date: string;
      meta: string;
      added: string;
      starred: boolean;
    };
    const out: Item[] = [];
    if (kind !== "sources") {
      for (const l of letters) {
        out.push({
          key: `l-${l.id}`,
          kind: "letter",
          id: l.id,
          identifier: l.archive_id,
          seq: l.fh_seq ?? 0,
          title: l.title || l.summary_short || "Untitled record",
          date: dateOf(l),
          meta: [l.author ? `From ${l.author}` : "", l.recipient ? `To ${l.recipient}` : ""]
            .filter(Boolean)
            .join(" · "),
          added: l.created_at ?? "",
          starred: true,
        });
      }
    }
    if (kind !== "records") {
      for (const s of starredSources) {
        out.push({
          key: `s-${s.id}`,
          kind: "source",
          id: s.id,
          identifier: s.ds_id,
          seq: s.ds_seq ?? 0,
          title: s.title || "Untitled source",
          date: s.original_date || s.normalized_date || "",
          meta: [s.creator ?? "", s.institution ?? ""].filter(Boolean).join(" · "),
          added: s.created_at ?? "",
          starred: true,
        });
      }
    }
    const sorted = [...out];
    sorted.sort((a, b) => {
      if (sort === "added") return (b.added || "").localeCompare(a.added || "");
      if (sort === "date") return (b.date || "").localeCompare(a.date || "");
      return a.identifier.localeCompare(b.identifier);
    });
    return sorted;
  }, [letters, starredSources, kind, sort]);

  return (
    <>
      <PageHeader
        title={`${FFF_SHORT} — ${FFF_NAME}`}
        description={`${FFF_PLURAL}: the headline discoveries of the archive — records and digital sources worth stopping for.`}
        center={<FffBadge size={72} />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "Everything"],
            ["records", "FH records"],
            ["sources", "Digital sources"],
          ] as [Kind, string][]
        ).map(([v, label]) => (
          <Button
            key={v}
            size="sm"
            variant={kind === v ? "default" : "outline"}
            onClick={() => setKind(v)}
          >
            {label}
          </Button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">Sort</span>
        {(
          [
            ["added", "Recently marked"],
            ["date", "Record date"],
            ["id", "Identifier"],
          ] as [Sort, string][]
        ).map(([v, label]) => (
          <Button
            key={v}
            size="sm"
            variant={sort === v ? "secondary" : "ghost"}
            onClick={() => setSort(v)}
          >
            {label}
          </Button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "find" : "finds"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <FffBadge size={56} className="mx-auto mb-3" muted />
          <p className="text-sm text-muted-foreground">
            No Francis File Finds yet. Mark a record or digital source with the {FFF_SHORT} badge and
            it headlines here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.key}
              className="relative rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <FffBadge size={26} />
                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  {it.kind === "letter" ? <Hash className="size-3" /> : <Globe className="size-3" />}
                  {it.identifier}
                </span>
                <span className="ml-auto">
                  <StarToggle
                    table={it.kind === "letter" ? "letters" : "digital_sources"}
                    id={it.id}
                    starred={it.starred}
                    label={`${it.identifier} — ${it.title}`}
                    size="sm"
                  />
                </span>
              </div>
              {it.kind === "letter" ? (
                <Link
                  to="/letters/$archiveId"
                  params={{ archiveId: it.identifier }}
                  className="font-display text-lg font-semibold leading-snug hover:underline"
                >
                  {it.title}
                </Link>
              ) : (
                <Link
                  to="/sources/$dsId"
                  params={{ dsId: it.id }}
                  className="font-display text-lg font-semibold leading-snug hover:underline"
                >
                  {it.title}
                </Link>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {[it.date, it.meta].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
