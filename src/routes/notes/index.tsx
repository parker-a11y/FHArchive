import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { categoryLabel, fetchNotes, noteTitle, normAlias, type FfnNote } from "@/lib/ffn";

export const Route = createFileRoute("/notes/")({
  head: () => ({
    meta: [
      { title: "Francis File Notes — The Francis Files" },
      {
        name: "description",
        content:
          "People, places, language and history from the Francis Harrington archive — a plain-language reference to the terms that appear in the letters.",
      },
      { property: "og:title", content: "Francis File Notes" },
      {
        property: "og:description",
        content: "People, places, language and history from the archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotesIndex,
});

type Sort = "az" | "recent" | "frequent";

function NotesIndex() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("az");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["ffn-notes", "published"],
    queryFn: () => fetchNotes(),
  });

  const categories = useMemo(
    () => [...new Set(notes.map((n) => n.category))].sort(),
    [notes],
  );

  const shown = useMemo(() => {
    const key = normAlias(q);
    let list = notes.filter((n) => category === "all" || n.category === category);
    if (key)
      list = list.filter((n) =>
        [n.term, n.title, n.expanded_name, n.short_definition]
          .filter(Boolean)
          .some((v) => normAlias(String(v)).includes(key)),
      );
    const by: Record<Sort, (a: FfnNote, b: FfnNote) => number> = {
      az: (a, b) => noteTitle(a).localeCompare(noteTitle(b)),
      recent: (a, b) => b.created_at.localeCompare(a.created_at),
      frequent: (a, b) => b.appearance_count - a.appearance_count,
    };
    return [...list].sort(by[sort]);
  }, [notes, q, category, sort]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-bold tracking-[0.2em] text-archive-gold uppercase">
          The Francis Files
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Francis File Notes
        </h1>
        <p className="mt-2 text-muted-foreground">
          People, places, language and history from the archive.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Francis File Notes"
            className="pl-9"
            aria-label="Search Francis File Notes"
          />
        </div>
        <div className="flex gap-2">
          {(["az", "recent", "frequent"] as Sort[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sort === s ? "default" : "outline"}
              onClick={() => setSort(s)}
            >
              {s === "az" ? "A–Z" : s === "recent" ? "Recently added" : "Most mentioned"}
            </Button>
          ))}
        </div>
      </div>

      {categories.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1 text-xs ${category === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs ${category === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
            >
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No published Francis File Notes yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {shown.map((n) => (
            <li key={n.id}>
              <Link
                to="/notes/$slug"
                params={{ slug: n.slug }}
                className="flex flex-col gap-1 p-4 hover:bg-muted/40 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className="font-display w-40 shrink-0 text-base font-semibold">
                  {noteTitle(n)}
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                  {n.expanded_name ? <em className="not-italic">{n.expanded_name} · </em> : null}
                  {n.short_definition}
                </span>
                {n.appearance_count > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {n.appearance_count} appearances
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
