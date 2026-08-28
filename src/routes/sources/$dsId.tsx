import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ExternalLink, Globe, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
import {
  SegmentsPanel,
  SourceConnectionsPanel,
  SourceLettersPanel,
} from "@/components/sources/SourcePanels";

export const Route = createFileRoute("/sources/$dsId")({
  head: () => ({
    meta: [
      { title: "Digital Source — Harrington Family Archive" },
      {
        name: "description",
        content: "Digital source record in the Harrington family archive.",
      },
      { property: "og:title", content: "Digital Source — Harrington Family Archive" },
      {
        property: "og:description",
        content: "Digital source record in the Harrington family archive.",
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
  const { data: source, isLoading } = useQuery({
    queryKey: ["source", dsId],
    queryFn: () => fetchSourceByDsId(dsId),
  });
  const [draft, setDraft] = useState<Partial<DigitalSource> | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading)
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!source)
    return (
      <p className="p-8 text-sm text-muted-foreground">
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
      <div className="no-print flex items-end justify-between gap-4 border-b border-border px-8 py-5">
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
          {source.url && (
            <Button variant="outline" className="gap-2" asChild>
              <a href={source.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open source
              </a>
            </Button>
          )}
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
        </div>
      </div>

      <div className="p-8">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="records">Linked FH Records</TabsTrigger>
            <TabsTrigger value="connections">People · Places · More</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            <div className="max-w-3xl space-y-5">
              <Field label="Title">
                <Input value={v("title")} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
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
              <Field label="Local file path">
                <Input value={v("local_file_path")} onChange={(e) => set("local_file_path", e.target.value)} placeholder="e.g. D:\Archive\downloads\…" />
              </Field>
              <Field label="Description">
                <Textarea rows={3} value={v("description")} onChange={(e) => set("description", e.target.value)} />
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
              <Button size="lg" disabled={!draft || saving} onClick={save}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="segments" className="mt-6">
            <SegmentsPanel source={source} />
          </TabsContent>
          <TabsContent value="records" className="mt-6">
            <SourceLettersPanel source={source} />
          </TabsContent>
          <TabsContent value="connections" className="mt-6">
            <SourceConnectionsPanel source={source} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
