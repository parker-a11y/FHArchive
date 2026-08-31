import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContainerPhotosPanel } from "@/components/containers/ContainerPhotosPanel";
import {
  CONTAINER_PROCESSING_STATUS,
  CONTAINER_TYPES,
  deleteContainer,
  fetchContainerByBoxId,
  fetchContainerRecords,
  updateContainer,
} from "@/lib/containers";
import { fetchLetters } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/containers/$boxId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.boxId} — Source Container — The Francis Files` },
      {
        name: "description",
        content: `Provenance record for source container ${params.boxId}: description, condition, inscriptions, documentation photographs, and the FH records that came out of it.`,
      },
      { property: "og:title", content: `${params.boxId} — Source Container` },
      {
        property: "og:description",
        content: `Original source container ${params.boxId} in The Francis Files.`,
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <ContainerPage />
    </AppShell>
  ),
});

function ContainerPage() {
  const { isAdmin, canEdit } = useAuth();
  const isGuestViewer = !canEdit;
  const { boxId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const { data: container, isLoading } = useQuery({
    queryKey: ["container", boxId],
    queryFn: () => fetchContainerByBoxId(boxId),
  });
  const { data: records = [] } = useQuery({
    queryKey: ["container-records", container?.id],
    queryFn: () => fetchContainerRecords(container!.id),
    enabled: !!container,
  });
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });

  useEffect(() => {
    if (!container) return;
    setForm({
      title: container.title,
      container_type: container.container_type,
      description: container.description ?? "",
      inscriptions: container.inscriptions ?? "",
      condition: container.condition ?? "",
      notes: container.notes ?? "",
      processing_status: container.processing_status,
      date_photographed: container.date_photographed ?? "",
      artifact_letter_id: container.artifact_letter_id ?? "",
    });
    setDirty(false);
  }, [container]);

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (!container)
    return (
      <div className="p-4">
        <p className="text-sm">No container found for {boxId}.</p>
        <Link to="/containers" className="text-sm text-primary underline">
          Back to containers
        </Link>
      </div>
    );

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  async function save() {
    if (!container) return;
    try {
      await updateContainer(container.id, {
        title: form.title.trim() || container.title,
        container_type: form.container_type,
        description: form.description || null,
        inscriptions: form.inscriptions || null,
        condition: form.condition || null,
        notes: form.notes || null,
        processing_status: form.processing_status,
        date_photographed: form.date_photographed || null,
        artifact_letter_id: form.artifact_letter_id || null,
      });
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["container", boxId] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    if (!container) return;
    if (!confirm(`Delete ${container.box_id}? FH records keep their data but lose this provenance link.`))
      return;
    try {
      await deleteContainer(container);
      qc.invalidateQueries({ queryKey: ["containers"] });
      toast.success("Container deleted");
      navigate({ to: "/containers" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={`${container.box_id} · ${container.title}`}
        description="Original source container — permanent provenance"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate({ to: "/containers" })}>
              <ArrowLeft className="size-4" /> All containers
            </Button>
            {!isGuestViewer && (
              <>
                <Button className="gap-2" disabled={!dirty} onClick={save}>
                  <Save className="size-4" /> Save
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={remove}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <fieldset disabled={isGuestViewer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="field-label">Title</label>
          <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Container type</label>
          <select
            className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
            value={form.container_type ?? "box"}
            onChange={(e) => set("container_type", e.target.value)}
          >
            {CONTAINER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Processing status</label>
          <select
            className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
            value={form.processing_status ?? "unprocessed"}
            onChange={(e) => set("processing_status", e.target.value)}
          >
            {CONTAINER_PROCESSING_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Condition</label>
          <Input
            placeholder="Water staining on lid; hinges intact"
            value={form.condition ?? ""}
            onChange={(e) => set("condition", e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Date photographed</label>
          <Input
            type="date"
            value={form.date_photographed ?? ""}
            onChange={(e) => set("date_photographed", e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Linked FH artifact record (optional)</label>
          <select
            className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
            value={form.artifact_letter_id ?? ""}
            onChange={(e) => set("artifact_letter_id", e.target.value)}
          >
            <option value="">— not cataloged as an artifact —</option>
            {letters.map((l) => (
              <option key={l.id} value={l.id}>
                {l.archive_id} · {l.title || l.primary_person || l.record_type}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Description</label>
            <Textarea
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Inscriptions / labels</label>
            <Textarea
              rows={3}
              placeholder="“Frank’s Navy things — 1944” written in pencil on the lid"
              value={form.inscriptions ?? ""}
              onChange={(e) => set("inscriptions", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Notes</label>
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div className="mt-8 border-t border-border pt-6">
        <fieldset disabled={isGuestViewer} className="contents">
          <ContainerPhotosPanel container={container} />
        </fieldset>
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h3 className="field-label mb-3">FH records from this container ({records.length})</h3>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No records attributed to this container yet.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Link
                  to="/letters/$archiveId"
                  params={{ archiveId: r.archive_id }}
                  className="archive-id text-base text-tone-blue hover:underline"
                >
                  {r.archive_id}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {r.title || `${r.author ?? "—"} → ${r.recipient ?? "—"}`}
                </span>
                {r.original_order_notes && (
                  <span className="text-xs text-muted-foreground">{r.original_order_notes}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
