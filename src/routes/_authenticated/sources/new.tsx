import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Globe } from "lucide-react";
import { FffBadge } from "@/components/FffBadge";
import { EditorOnly, AppShell, PageHeader } from "@/components/AppShell";
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
import { DS_SOURCE_TYPES, createDigitalSource, previewNextDsId } from "@/lib/sources";
import { RelatedRecordsField, type PendingRelation } from "@/components/RelatedRecordsPanel";
import { addRecordLink } from "@/lib/record-links";
import { DATE_PRECISION } from "@/lib/archive";


export const Route = createFileRoute("/_authenticated/sources/new")({
  head: () => ({
    meta: [
      { title: "Add Digital Source — The Francis Files" },
      {
        name: "description",
        content: "Catalog a new digital or external research source with a permanent DS number.",
      },
      { property: "og:title", content: "Add Digital Source — The Francis Files" },
      {
        property: "og:description",
        content: "Catalog a new digital or external research source with a permanent DS number.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <EditorOnly>
      <AppShell>
        <NewSource />
      </AppShell>
    </EditorOnly>
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

function NewSource() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [starred, setStarred] = useState(false);
  const [relations, setRelations] = useState<PendingRelation[]>([]);
  const [form, setForm] = useState({
    title: "",
    source_type: "website",
    creator: "",
    institution: "",
    original_date: "",
    normalized_date: "",
    date_precision: "unknown",
    date_accessed: "",
    historical_date_range: "",
    url: "",
    description: "",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: next } = useQuery({ queryKey: ["nextDs"], queryFn: previewNextDsId });

  async function save(openRecord: boolean) {
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      const created = await createDigitalSource({
        ...form,
        title: form.title.trim(),
      });
      if (starred) {
        await supabase.from("digital_sources").update({ starred: true }).eq("id", created.id);
      }
      for (const r of relations) {
        try {
          await addRecordLink(
            { kind: "source", id: created.id },
            { kind: r.record.kind, id: r.record.id },
            r.note,
          );
        } catch (err) {
          toast.error(`Could not link ${r.record.ref}: ${(err as Error).message}`);
        }
      }
      setRelations([]);
      toast.success(`Saved ${created.ds_id}`);
      if (openRecord) {
        navigate({ to: "/sources/$dsId", params: { dsId: created.ds_id } });
      } else {
        setForm((f) => ({
          ...f,
          title: "",
          creator: "",
          institution: "",
          original_date: "",
          historical_date_range: "",
          url: "",
          description: "",
          notes: "",
        }));
        // re-fetch next id preview
        window.location.reload();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Add Digital Source"
        description="Catalog an external or digital research source"
        actions={
          next && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
              <Globe className="size-5 text-tone-teal" />
              <div>
                <div className="field-label">Next DS number</div>
                <div className="archive-id text-xl">{next.ds_id}</div>
              </div>
            </div>
          )
        }
      />
      <div className="max-w-3xl space-y-5 p-4 sm:p-8">
        <Field label="Title *">
          <Input value={form.title} onChange={set("title")} placeholder="e.g. USS Enterprise CV-6 combat footage, 1944" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Source type">
            <Select
              value={form.source_type}
              onValueChange={(v) => setForm((f) => ({ ...f, source_type: v }))}
            >
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
            <Input value={form.creator} onChange={set("creator")} placeholder="Person or studio" />
          </Field>
          <Field label="Institution / Repository">
            <Input value={form.institution} onChange={set("institution")} placeholder="e.g. NARA, Naval History and Heritage Command" />
          </Field>
          <Field label="Original date (as shown)">
            <Input value={form.original_date} onChange={set("original_date")} placeholder="e.g. 1944, c. 1943" />
          </Field>
          <Field label="Normalized date (for sorting)">
            <Input type="date" value={form.normalized_date} onChange={set("normalized_date")} />
          </Field>
          <Field label="Date precision">
            <Select
              value={form.date_precision}
              onValueChange={(v) => setForm((f) => ({ ...f, date_precision: v }))}
            >
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
            <Input value={form.historical_date_range} onChange={set("historical_date_range")} placeholder="e.g. 1943–1945" />
          </Field>
          <Field label="Date accessed">
            <Input type="date" value={form.date_accessed} onChange={set("date_accessed")} />
          </Field>
        </div>
        <Field label="URL">
          <Input value={form.url} onChange={set("url")} placeholder="https://…" />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={form.description} onChange={set("description")} placeholder="What this source contains and why it matters…" />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={form.notes} onChange={set("notes")} />
        </Field>
        <div>
          <span className="field-label mb-1.5 block">Related records (optional)</span>
          <RelatedRecordsField value={relations} onChange={setRelations} />
          <p className="mt-1 text-xs text-muted-foreground">
            Historical connections to any other archive record — physical or digital. Links work
            both ways and do not affect provenance or storage.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={starred}
            onChange={(e) => setStarred(e.target.checked)}
          />
          <FffBadge size={18} muted={!starred} />
          FFF — Francis File Find
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button size="lg" disabled={saving} onClick={() => save(true)}>
            Save &amp; open record
          </Button>
          <Button size="lg" variant="outline" disabled={saving} onClick={() => save(false)}>
            Save &amp; add another
          </Button>
        </div>
      </div>

    </>
  );
}
