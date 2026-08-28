import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Globe, Paperclip, Plus, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DS_SOURCE_TYPES, dsTypeLabel, fetchDsFileCounts, fetchSources } from "@/lib/sources";

export const Route = createFileRoute("/sources/")({
  head: () => ({
    meta: [
      { title: "Digital Sources — Harrington Family Archive" },
      {
        name: "description",
        content:
          "Catalog of digital and external research sources — web archives, videos, books, maps, and more — linked to FH records.",
      },
      { property: "og:title", content: "Digital Sources — Harrington Family Archive" },
      {
        property: "og:description",
        content: "Digital and external research sources linked to the Harrington family archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <SourcesList />
    </AppShell>
  ),
});

function SourcesList() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const { data: fileCounts = {} } = useQuery({
    queryKey: ["ds-file-counts"],
    queryFn: fetchDsFileCounts,
  });


  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sources.filter((s) => {
      if (type !== "all" && s.source_type !== type) return false;
      if (!needle) return true;
      return [s.ds_id, s.title, s.creator, s.institution, s.url, s.description, s.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [sources, q, type]);

  return (
    <>
      <PageHeader
        title="Digital Sources"
        description={`${sources.length} research sources cataloged`}
        actions={
          <Button
            size="lg"
            className="gap-2 rounded-full px-6 shadow-lg transition-all hover:shadow-xl active:scale-95"
            onClick={() => navigate({ to: "/sources/new" })}
          >
            <Plus className="size-4 text-archive-gold" /> ADD DIGITAL SOURCE
          </Button>
        }
      />
      <div className="p-4 sm:p-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative w-80">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search sources…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {DS_SOURCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {sources.length}
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="divide-y divide-border">
              {filtered.length === 0 && (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  No digital sources yet. Add your first one.
                </p>
              )}
              {filtered.map((s) => (
                <Link
                  key={s.id}
                  to="/sources/$dsId"
                  params={{ dsId: s.ds_id }}
                  className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/60"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tone-teal-soft text-tone-teal">
                    <Globe className="size-4" />
                  </div>
                  <span className="archive-id w-20 text-base">{s.ds_id}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="block truncate text-muted-foreground">
                      {[s.creator, s.institution, s.historical_date_range]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {dsTypeLabel(s.source_type)}
                  </span>
                  {(fileCounts[s.id] ?? 0) > 0 && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-tone-teal-soft px-2.5 py-0.5 text-xs font-medium text-tone-teal">
                      <Paperclip className="size-3" /> {fileCounts[s.id]}
                    </span>
                  )}
                  {s.url && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />}

                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
