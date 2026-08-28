import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Link2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchSegments,
  fetchSourceLetters,
  type DigitalSource,
  type DsSegment,
} from "@/lib/sources";

// Untyped client for dynamic (config-driven) table access in EntityLinker.
/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as unknown as {
  from: (table: string) => any;
};

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export function SegmentsPanel({ source }: { source: DigitalSource }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    start_ts: "",
    end_ts: "",
    title: "",
    description: "",
    url: "",
    keywords: "",
  });
  const { data: segments = [] } = useQuery({
    queryKey: ["segments", source.id],
    queryFn: () => fetchSegments(source.id),
  });

  async function add() {
    if (!form.title.trim()) return toast.error("Segment title is required");
    const { error } = await supabase.from("ds_segments").insert({
      source_id: source.id,
      sort_order: segments.length + 1,
      start_ts: form.start_ts || null,
      end_ts: form.end_ts || null,
      title: form.title.trim(),
      description: form.description || null,
      url: form.url || null,
      keywords: form.keywords || null,
    });
    if (error) return toast.error(error.message);
    setForm({ start_ts: "", end_ts: "", title: "", description: "", url: "", keywords: "" });
    qc.invalidateQueries({ queryKey: ["segments", source.id] });
  }

  async function remove(seg: DsSegment) {
    const { error } = await supabase.from("ds_segments").delete().eq("id", seg.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["segments", source.id] });
  }

  const input =
    (k: keyof typeof form, placeholder: string, className = "") =>
    (
      <Input
        className={className}
        placeholder={placeholder}
        value={form[k]}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
      />
    );

  return (
    <div className="max-w-4xl">
      <h3 className="field-label mb-3">Segments / timestamps ({segments.length})</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Break long sources (videos, books, maps) into important parts — e.g. “0:42 – flight deck
        operations”.
      </p>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="min-w-24 rounded-lg bg-tone-teal-soft px-2 py-1 text-center font-mono text-xs font-semibold text-tone-teal">
              {[seg.start_ts, seg.end_ts].filter(Boolean).join(" – ") || "—"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{seg.title}</span>
                {seg.url && (
                  <a
                    href={seg.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-tone-blue hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
              {seg.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{seg.description}</p>
              )}
              {seg.keywords && (
                <p className="mt-1 text-xs text-muted-foreground">Tags: {seg.keywords}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(seg)}>
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {segments.length === 0 && (
          <p className="text-sm text-muted-foreground">No segments yet.</p>
        )}
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-dashed border-border bg-muted/40 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_2fr] gap-2">
          {input("start_ts", "Start (e.g. 12:34)")}
          {input("end_ts", "End")}
          {input("title", "Segment title *")}
        </div>
        {input("description", "Description")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {input("url", "Direct URL to this part")}
          {input("keywords", "Tags (comma separated)")}
        </div>
        <Button size="sm" className="gap-1.5" onClick={add}>
          <Plus className="size-3.5" /> Add segment
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linked FH records (from the source side)
// ---------------------------------------------------------------------------

export function SourceLettersPanel({ source }: { source: DigitalSource }) {
  const qc = useQueryClient();
  const [archiveId, setArchiveId] = useState("");
  const [explanation, setExplanation] = useState("");
  const { data: links = [] } = useQuery({
    queryKey: ["sourceLetters", source.id],
    queryFn: () => fetchSourceLetters(source.id),
  });

  async function link() {
    const id = archiveId.trim().toUpperCase();
    if (!id) return;
    const { data: letter } = await supabase
      .from("letters")
      .select("id")
      .eq("archive_id", id)
      .maybeSingle();
    if (!letter) return toast.error(`No FH record ${id}`);
    const { error } = await supabase.from("letter_sources").insert({
      letter_id: letter.id,
      source_id: source.id,
      explanation: explanation || null,
    });
    if (error) return toast.error(error.message.includes("duplicate") ? "Already linked" : error.message);
    setArchiveId("");
    setExplanation("");
    qc.invalidateQueries({ queryKey: ["sourceLetters", source.id] });
    toast.success(`Linked to ${id}`);
  }

  async function unlink(linkId: string) {
    const { error } = await supabase.from("letter_sources").delete().eq("id", linkId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sourceLetters", source.id] });
  }

  return (
    <div className="max-w-3xl">
      <h3 className="field-label mb-3">Linked FH records ({links.length})</h3>
      <div className="space-y-2">
        {links.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <Link
              to="/letters/$archiveId"
              params={{ archiveId: l.letters?.archive_id ?? "" }}
              className="archive-id text-base text-tone-blue hover:underline"
            >
              {l.letters?.archive_id}
            </Link>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {l.letters?.title ||
                  `${l.letters?.author ?? "—"} → ${l.letters?.recipient ?? "—"}`}
              </span>
              {l.explanation && (
                <span className="block text-sm text-muted-foreground">{l.explanation}</span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => unlink(l.id)}>
              <X className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground">Not linked to any FH records yet.</p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-4">
        <Input
          className="w-32"
          placeholder="FH0001"
          value={archiveId}
          onChange={(e) => setArchiveId(e.target.value)}
        />
        <Input
          className="min-w-60 flex-1"
          placeholder="Why is this source relevant? (optional)"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
        <Button size="sm" className="gap-1.5" onClick={link}>
          <Link2 className="size-3.5" /> Link record
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic entity linker (people / places / organizations / events / keywords)
// ---------------------------------------------------------------------------

type EntityConfig = {
  joinTable: string;
  entityTable: string;
  entityKey: string; // column on join table holding entity id
  nameColumn: string; // column on entity table to display/search
  label: string;
  insertDefaults?: Record<string, unknown>;
};

function EntityLinker({ source, config }: { source: DigitalSource; config: EntityConfig }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const qk = ["dsLink", config.joinTable, source.id];

  const { data: links = [] } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await db
        .from(config.joinTable)
        .select(`id, ${config.entityKey}, ${config.entityTable}(${config.nameColumn})`)
        .eq("source_id", source.id);
      if (error) throw error;
      return (data ?? []) as { id: string; [k: string]: unknown }[];
    },
  });
  const { data: entities = [] } = useQuery({
    queryKey: [config.entityTable],
    queryFn: async () => {
      const { data, error } = await db
        .from(config.entityTable)
        .select(`id, ${config.nameColumn}`)
        .order(config.nameColumn);
      if (error) throw error;
      return (data ?? []) as { id: string; [k: string]: string }[];
    },
  });

  const linkedIds = new Set(links.map((l) => l[config.entityKey] as string));

  async function addLink(entityId: string) {
    const { error } = await db
      .from(config.joinTable)
      .insert({ source_id: source.id, [config.entityKey]: entityId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: qk });
  }

  async function createAndLink() {
    const name = newName.trim();
    if (!name) return;
    const { data, error } = await db
      .from(config.entityTable)
      .insert({ [config.nameColumn]: name, ...(config.insertDefaults ?? {}) })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setNewName("");
    qc.invalidateQueries({ queryKey: [config.entityTable] });
    await addLink((data as { id: string }).id);
  }

  async function unlink(linkId: string) {
    const { error } = await db.from(config.joinTable).delete().eq("id", linkId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: qk });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="field-label mb-2">{config.label}</h4>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {links.map((l) => {
          const entity = l[config.entityTable] as { [k: string]: string } | null;
          return (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-full bg-tone-blue-soft px-2.5 py-1 text-xs font-medium text-tone-blue"
            >
              {entity?.[config.nameColumn]}
              <button onClick={() => unlink(l.id)} className="hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          );
        })}
        {links.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Select
          value={selected}
          onValueChange={(v) => {
            setSelected("");
            addLink(v);
          }}
        >
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder="Link existing…" />
          </SelectTrigger>
          <SelectContent>
            {entities
              .filter((e) => !linkedIds.has(e.id))
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e[config.nameColumn]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 w-44 text-xs"
          placeholder="Or create new…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createAndLink()}
        />
        <Button size="sm" variant="outline" className="h-8" onClick={createAndLink}>
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SourceConnectionsPanel({ source }: { source: DigitalSource }) {
  return (
    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
      <EntityLinker
        source={source}
        config={{
          joinTable: "ds_people",
          entityTable: "people",
          entityKey: "person_id",
          nameColumn: "name",
          label: "People",
        }}
      />
      <EntityLinker
        source={source}
        config={{
          joinTable: "ds_places",
          entityTable: "places",
          entityKey: "place_id",
          nameColumn: "canonical_name",
          label: "Places",
        }}
      />
      <EntityLinker
        source={source}
        config={{
          joinTable: "ds_organizations",
          entityTable: "organizations",
          entityKey: "organization_id",
          nameColumn: "name",
          label: "Organizations / Ships / Units",
        }}
      />
      <EntityLinker
        source={source}
        config={{
          joinTable: "ds_events",
          entityTable: "events",
          entityKey: "event_id",
          nameColumn: "name",
          label: "Events",
        }}
      />
      <EntityLinker
        source={source}
        config={{
          joinTable: "ds_keywords",
          entityTable: "keywords",
          entityKey: "keyword_id",
          nameColumn: "name",
          label: "Keywords",
        }}
      />
    </div>
  );
}
