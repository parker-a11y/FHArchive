import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ExternalLink, Globe, Trash2 } from "lucide-react";
import { StarToggle } from "@/components/StarToggle";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  DS_SOURCE_TYPES,
  dsTypeLabel,
  fetchSourceByDsId,
  type DigitalSource,
} from "@/lib/sources";
import { DATE_PRECISION } from "@/lib/archive";
import {
  SegmentsPanel,
  SourceConnectionsPanel,
  SourceLettersPanel,
} from "@/components/sources/SourcePanels";
import { DsFilesPanel } from "@/components/sources/DsFilesPanel";
import {
  ShareSourceDialog,
  SourceShareStatusBadge,
} from "@/components/sources/ShareSourceDialog";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { RelatedRecordsPanel } from "@/components/RelatedRecordsPanel";


export const Route = createFileRoute("/_authenticated/sources/$dsId")({
  head: () => ({
    meta: [
      { title: "Digital Source — The Francis Files" },
      {
        name: "description",
        content: "Digital source record in The Francis Files.",
      },
      { property: "og:title", content: "Digital Source — The Francis Files" },
      {
        property: "og:description",
        content: "Digital source record in The Francis Files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <SourcePage />
    </AppShell>
  ),
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function SourcePage() {
  const { dsId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isGuestViewer, isAdmin } = useAuth();
  const { data: source, isLoading } = useQuery({
    queryKey: ["source", dsId],
    queryFn: () => fetchSourceByDsId(dsId),
  });
  const [draft, setDraft] = useState<Partial<DigitalSource> | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading)
    return <p className="p-4 sm:p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!source)
    return (
      <p className="p-4 sm:p-8 text-sm text-muted-foreground">
        Source {dsId} not found. <Link to="/sources" className="underline">Back to sources</Link>
      </p>
    );

  const v = (k: keyof DigitalSource) => (draft?.[k] ?? source[k] ?? "") as string;
  const set = (k: keyof DigitalSource, value: string) =>
    setDraft((d) => ({ ...(d ?? {}), [k]: value }));

  async function save() {
    if (!draft) return;
    setSaving(true);
    const updates = Object.fromEntries(
      Object.entries(draft).map(([k, val]) => [k, val === "" ? null : val]),
    ) as never;
    const { error } = await supabase.from("digital_sources").update(updates).eq("id", source!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["source", dsId] });
    qc.invalidateQueries({ queryKey: ["sources"] });
  }

  async function remove() {
    const { error } = await supabase.from("digital_sources").delete().eq("id", source!.id);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${source!.ds_id}`);
    navigate({ to: "/sources" });
  }

  const prev = `DS-${String(source.ds_seq - 1).padStart(4, "0")}`;
  const nextId = `DS-${String(source.ds_seq + 1).padStart(4, "0")}`;

  return (
    <>
      <div className="no-print flex items-end justify-between gap-4 border-b border-border px-4 sm:px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-tone-teal-soft text-tone-teal">
            <Globe className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="archive-id text-2xl">{source.ds_id}</h1>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {dsTypeLabel(source.source_type)}
              </span>
              <SourceShareStatusBadge visibility={source.visibility} />
              <StarToggle
                table="digital_sources"
                id={source.id}
                starred={Boolean(source.starred)}
                label={`${source.ds_id} — ${source.title}`}
              />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{source.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate({ to: "/sources/$dsId", params: { dsId: prev } })} disabled={source.ds_seq <= 1}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate({ to: "/sources/$dsId", params: { dsId: nextId } })}>
            <ChevronRight className="size-4" />
          </Button>
          {isAdmin && (
            <>
              <ShareSourceDialog source={source} />
              <EmailArchiveDialog
                kind="source"
                id={source.id}
                identifier={source.ds_id}
                title={source.title}
              />
            </>
          )}

          {source.url && (
            <Button variant="outline" className="gap-2" asChild>
              <a href={source.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open source
              </a>
            </Button>
          )}
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {source.ds_id}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the source, its segments, and all links to FH records.
                    The DS number is not reused.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-8">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>

            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="related">Related Records</TabsTrigger>
            <TabsTrigger value="records">Linked FH Records</TabsTrigger>
            <TabsTrigger value="connections">People · Places · More</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <fieldset disabled={isGuestViewer} className="contents">
            <div className="max-w-3xl space-y-5">
              <Field label="Title">
                <Input value={v("title")} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Source type">
                  <Select value={v("source_type")} onValueChange={(val) => set("source_type", val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DS_SOURCE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Creator / Author">
                  <Input value={v("creator")} onChange={(e) => set("creator", e.target.value)} />
                </Field>
                <Field label="Institution / Repository">
                  <Input value={v("institution")} onChange={(e) => set("institution", e.target.value)} />
                </Field>
                <Field label="Original date (as shown)">
                  <Input value={v("original_date")} onChange={(e) => set("original_date", e.target.value)} />
                </Field>
                <Field label="Normalized date (for sorting)">
                  <Input type="date" value={v("normalized_date")} onChange={(e) => set("normalized_date", e.target.value)} />
                </Field>
                <Field label="Date precision">
                  <Select value={v("date_precision") || "unknown"} onValueChange={(val) => set("date_precision", val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_PRECISION.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Historical date range">
                  <Input value={v("historical_date_range")} onChange={(e) => set("historical_date_range", e.target.value)} />
                </Field>
                <Field label="Date accessed">
                  <Input type="date" value={v("date_accessed")} onChange={(e) => set("date_accessed", e.target.value)} />
                </Field>
              </div>
              <Field label="URL">
                <Input value={v("url")} onChange={(e) => set("url", e.target.value)} />
              </Field>

              <Field label="Description">
                <Textarea rows={3} value={v("description")} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Transcription / AI status">
                <Select
                  value={(draft?.transcription_status ?? source.transcription_status ?? "needed") as string}
                  onValueChange={(val) => set("transcription_status", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TRANSCRIPTION_STATUS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Transcript / extracted text">
                <Textarea rows={5} value={v("transcript")} onChange={(e) => set("transcript", e.target.value)} />
              </Field>
              <Field label="Citation">
                <Textarea rows={2} value={v("citation")} onChange={(e) => set("citation", e.target.value)} />
              </Field>
              <Field label="Rights / usage notes">
                <Input value={v("rights_notes")} onChange={(e) => set("rights_notes", e.target.value)} />
              </Field>
              <Field label="Notes">
                <Textarea rows={2} value={v("notes")} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              {!isGuestViewer && (
                <Button size="lg" disabled={!draft || saving} onClick={save}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              )}
            </div>
            </fieldset>
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            <fieldset disabled={isGuestViewer} className="contents">
              <DsFilesPanel source={source} />
            </fieldset>
          </TabsContent>
          <TabsContent value="segments" className="mt-6">
            <fieldset disabled={isGuestViewer} className="contents">
              <SegmentsPanel source={source} />
            </fieldset>
          </TabsContent>

          <TabsContent value="related" className="mt-6">
            <RelatedRecordsPanel kind="source" id={source.id} readOnly={isGuestViewer} />
          </TabsContent>

          <TabsContent value="records" className="mt-6">
            <fieldset disabled={isGuestViewer} className="contents">
              <SourceLettersPanel source={source} />
            </fieldset>
          </TabsContent>
          <TabsContent value="connections" className="mt-6">
            <fieldset disabled={isGuestViewer} className="contents">
              <SourceConnectionsPanel source={source} />
            </fieldset>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
