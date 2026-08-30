import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Box, Plus, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CONTAINER_PROCESSING_STATUS,
  CONTAINER_TYPES,
  containerStatusLabel,
  containerTypeLabel,
  createContainer,
  fetchContainerRecordCounts,
  fetchContainers,
} from "@/lib/containers";

export const Route = createFileRoute("/_authenticated/containers/")({
  head: () => ({
    meta: [
      { title: "Source Containers — The Francis Files" },
      {
        name: "description",
        content:
          "Boxes, trunks, albums and bundles the collection arrived in — permanent provenance for every FH record.",
      },
      { property: "og:title", content: "Source Containers — The Francis Files" },
      {
        property: "og:description",
        content: "Original source containers documenting the provenance of The Francis Files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <ContainersList />
    </AppShell>
  ),
});

function ContainersList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("box");
  const [saving, setSaving] = useState(false);

  const { data: containers = [], isLoading } = useQuery({
    queryKey: ["containers"],
    queryFn: fetchContainers,
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["container-record-counts"],
    queryFn: fetchContainerRecordCounts,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return containers.filter((c) => {
      if (status !== "all" && c.processing_status !== status) return false;
      if (!needle) return true;
      return [c.box_id, c.title, c.description, c.inscriptions, c.condition, c.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [containers, q, status]);

  async function add() {
    const t = title.trim();
    if (!t) return toast.error("Give the container a title");
    setSaving(true);
    try {
      const row = await createContainer({ title: t, container_type: type });
      await qc.invalidateQueries({ queryKey: ["containers"] });
      toast.success(`Created ${row.box_id}`);
      navigate({ to: "/containers/$boxId", params: { boxId: row.box_id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Source Containers"
        description={`${containers.length} original containers documented`}
      />

      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-4">
        <div className="min-w-56 flex-1">
          <label className="field-label">New container title</label>
          <Input
            placeholder="Attic trunk — blue steamer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </div>
        <div>
          <label className="field-label">Type</label>
          <select
            className="h-9 rounded border border-input bg-background px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {CONTAINER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <Button className="gap-2" disabled={saving} onClick={add}>
          <Plus className="size-4" /> ADD CONTAINER
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search containers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {CONTAINER_PROCESSING_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No containers yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/containers/$boxId"
              params={{ boxId: c.box_id }}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <Box className="size-4 text-archive-gold" />
                <span className="archive-id text-base text-tone-blue">{c.box_id}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {containerStatusLabel(c.processing_status)}
                </span>
              </div>
              <div className="mt-2 font-medium">{c.title}</div>
              <div className="text-xs text-muted-foreground">
                {containerTypeLabel(c.container_type)} · {counts[c.id] ?? 0} FH records
              </div>
              {c.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
