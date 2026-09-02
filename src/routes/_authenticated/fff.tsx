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

  const featured = items[0];
  const rest = items.slice(1);

  return (
    <>
      {/* Masthead — navy archive banner with gold find mark */}
      <div
        className="relative mb-8 overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-14"
        style={{
          background:
            "linear-gradient(160deg, var(--archive-ink) 0%, color-mix(in oklab, var(--archive-ink) 82%, black) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, var(--archive-gold) 0, transparent 40%), radial-gradient(circle at 85% 90%, var(--archive-gold) 0, transparent 45%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-4 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--archive-gold), transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 bottom-4 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--archive-gold), transparent)" }}
        />
        <FffBadge size={84} className="mx-auto mb-4 drop-shadow-lg" />
        <h1
          className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: "var(--archive-gold)" }}
        >
          {FFF_PLURAL}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed" style={{ color: "oklch(0.85 0.02 85)" }}>
          The headline discoveries of the archive — the records and digital sources worth stopping for.
        </p>
        <p
          className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-medium uppercase tracking-[0.2em]"
          style={{
            color: "var(--archive-gold)",
            border: "1px solid color-mix(in oklab, var(--archive-gold) 40%, transparent)",
          }}
        >
          {items.length} {items.length === 1 ? "find" : "finds"} starred
        </p>
      </div>

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
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <FffBadge size={64} className="mx-auto mb-4" muted />
          <p className="font-display text-lg font-semibold">No finds yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Mark a record or digital source with the {FFF_SHORT} badge and it headlines here.
          </p>
        </div>
      ) : (
        <>
          {featured && (
            <Link
              key={featured.key}
              to={featured.kind === "letter" ? "/letters/$archiveId" : "/sources/$dsId"}
              params={
                featured.kind === "letter"
                  ? { archiveId: featured.identifier }
                  : { dsId: featured.id }
              }
              className="group relative mb-6 block overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ borderTop: "3px solid var(--archive-gold)" }}
            >
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
                <FffBadge size={72} className="shrink-0 drop-shadow transition group-hover:scale-105" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs text-accent-foreground">
                      {featured.kind === "letter" ? <Hash className="size-3" /> : <Globe className="size-3" />}
                      {featured.identifier}
                    </span>
                    <span
                      className="text-xs font-medium uppercase tracking-[0.15em]"
                      style={{ color: "var(--archive-gold-strong)" }}
                    >
                      Latest find
                    </span>
                  </div>
                  <h2 className="font-display text-2xl font-semibold leading-snug group-hover:underline sm:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[featured.date, featured.meta].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="shrink-0 self-start sm:self-center" onClick={(e) => e.preventDefault()}>
                  <StarToggle
                    table={featured.kind === "letter" ? "letters" : "digital_sources"}
                    id={featured.id}
                    starred={featured.starred}
                    label={`${featured.identifier} — ${featured.title}`}
                  />
                </span>
              </div>
            </Link>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((it) => (
              <div
                key={it.key}
                className="group relative rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderTop: "2px solid color-mix(in oklab, var(--archive-gold) 55%, transparent)" }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <FffBadge size={26} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/60 px-2 py-0.5 font-mono text-xs text-accent-foreground">
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
                    className="font-display text-lg font-semibold leading-snug group-hover:underline"
                  >
                    {it.title}
                  </Link>
                ) : (
                  <Link
                    to="/sources/$dsId"
                    params={{ dsId: it.id }}
                    className="font-display text-lg font-semibold leading-snug group-hover:underline"
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
        </>
      )}
    </>
  );
}
