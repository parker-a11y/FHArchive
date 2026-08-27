import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_FIELDS,
  REFERENCE_TYPES,
  RELATION_TYPES,
  RESEARCH_STATUS,
  labelOf,
} from "@/lib/archive";
import { fetchLetters, type Letter } from "@/lib/queries";

/* ---------------- People / Places / Keywords links ---------------- */

export function LinksPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["links", letter.id] });
    qc.invalidateQueries({ queryKey: ["letter_keywords_all"] });
  };

  const { data: entities } = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const [p, pl, k] = await Promise.all([
        supabase.from("people").select("id,name").order("name"),
        supabase.from("places").select("id,canonical_name").order("canonical_name"),
        supabase.from("keywords").select("id,name").order("name"),
      ]);
      return { people: p.data ?? [], places: pl.data ?? [], keywords: k.data ?? [] };
    },
  });

  const { data: links } = useQuery({
    queryKey: ["links", letter.id],
    queryFn: async () => {
      const [p, pl, k] = await Promise.all([
        supabase.from("letter_people").select("id, role, person_id, people(name)").eq("letter_id", letter.id),
        supabase
          .from("letter_places")
          .select("id, role, place_id, places(canonical_name)")
          .eq("letter_id", letter.id),
        supabase
          .from("letter_keywords")
          .select("id, source, confirmed, keyword_id, keywords(name)")
          .eq("letter_id", letter.id),
      ]);
      return { people: p.data ?? [], places: pl.data ?? [], keywords: k.data ?? [] };
    },
  });

  const [personId, setPersonId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [keywordName, setKeywordName] = useState("");

  async function addPerson() {
    if (!personId) return;
    const { error } = await supabase
      .from("letter_people")
      .insert({ letter_id: letter.id, person_id: personId, role: "mentioned" });
    if (error) return toast.error(error.message);
    setPersonId("");
    inval();
  }
  async function addPlace() {
    if (!placeId) return;
    const { error } = await supabase
      .from("letter_places")
      .insert({ letter_id: letter.id, place_id: placeId, role: "mentioned" });
    if (error) return toast.error(error.message);
    setPlaceId("");
    inval();
  }
  async function addKeyword() {
    const name = keywordName.trim();
    if (!name) return;
    let id = entities?.keywords.find((k) => k.name.toLowerCase() === name.toLowerCase())?.id;
    if (!id) {
      const { data, error } = await supabase.from("keywords").insert({ name }).select("id").single();
      if (error) return toast.error(error.message);
      id = data.id;
    }
    const { error } = await supabase
      .from("letter_keywords")
      .insert({ letter_id: letter.id, keyword_id: id, source: "human", confirmed: true });
    if (error) return toast.error(error.message);
    setKeywordName("");
    qc.invalidateQueries({ queryKey: ["keywords"] });
    inval();
  }
  async function del(table: string, id: string) {
    await (supabase.from(table as "letter_people") as any).delete().eq("id", id);
    inval();
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div>
        <h3 className="field-label mb-2">People</h3>
        <div className="mb-2 flex gap-2">
          <select
            className="h-9 flex-1 rounded border border-input bg-background px-2 text-sm"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
          >
            <option value="">Select person…</option>
            {entities?.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addPerson}>
            Add
          </Button>
        </div>
        {links?.people.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-1 text-sm">
            <Link to="/people/$personId" params={{ personId: r.person_id }} className="hover:underline">
              {r.people?.name}
            </Link>
            <button onClick={() => del("letter_people", r.id)}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      <div>
        <h3 className="field-label mb-2">Places</h3>
        <div className="mb-2 flex gap-2">
          <select
            className="h-9 flex-1 rounded border border-input bg-background px-2 text-sm"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
          >
            <option value="">Select place…</option>
            {entities?.places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.canonical_name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addPlace}>
            Add
          </Button>
        </div>
        {links?.places.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-1 text-sm">
            <Link to="/places/$placeId" params={{ placeId: r.place_id }} className="hover:underline">
              {r.places?.canonical_name}
            </Link>
            <button onClick={() => del("letter_places", r.id)}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      <div>
        <h3 className="field-label mb-2">Keywords</h3>
        <div className="mb-2 flex gap-2">
          <Input
            className="h-9"
            placeholder="Add or create keyword…"
            value={keywordName}
            onChange={(e) => setKeywordName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            list="kw-list"
          />
          <datalist id="kw-list">
            {entities?.keywords.map((k) => (
              <option key={k.id} value={k.name} />
            ))}
          </datalist>
          <Button size="sm" onClick={addKeyword}>
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {links?.keywords.map((r) => (
            <span
              key={r.id}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs ${
                r.source === "ai"
                  ? "border-archive-ai/40 bg-archive-ai-surface text-archive-ai"
                  : "border-border bg-secondary"
              }`}
            >
              <Link to="/keywords/$keywordId" params={{ keywordId: r.keyword_id }}>
                {r.keywords?.name}
              </Link>
              {r.source === "ai" && !r.confirmed && (
                <button
                  title="Confirm"
                  onClick={async () => {
                    await supabase
                      .from("letter_keywords")
                      .update({ confirmed: true, source: "human" })
                      .eq("id", r.id);
                    inval();
                  }}
                >
                  ✓
                </button>
              )}
              <button onClick={() => del("letter_keywords", r.id)}>×</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Historical references ---------------- */

export function ReferencesPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const { data: refs = [] } = useQuery({
    queryKey: ["refs", letter.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("historical_references")
        .select("*")
        .eq("letter_id", letter.id)
        .order("created_at");
      return data ?? [];
    },
  });
  const [draft, setDraft] = useState({
    reference: "",
    ref_type: "Other",
    description: "",
    research_status: "not_started",
    notes: "",
    source_links: "",
  });

  async function add() {
    if (!draft.reference.trim()) return;
    const { error } = await supabase
      .from("historical_references")
      .insert({ ...draft, letter_id: letter.id });
    if (error) return toast.error(error.message);
    setDraft({ ...draft, reference: "", description: "", notes: "", source_links: "" });
    qc.invalidateQueries({ queryKey: ["refs", letter.id] });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="grid grid-cols-2 gap-3 rounded border border-border bg-card p-4">
        <div>
          <label className="field-label">Reference</label>
          <Input
            value={draft.reference}
            onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label">Type</label>
          <select
            className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
            value={draft.ref_type}
            onChange={(e) => setDraft({ ...draft, ref_type: e.target.value })}
          >
            {REFERENCE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="field-label">Description</label>
          <Input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label">Research status</label>
          <select
            className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
            value={draft.research_status}
            onChange={(e) => setDraft({ ...draft, research_status: e.target.value })}
          >
            {RESEARCH_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Source links</label>
          <Input
            value={draft.source_links}
            onChange={(e) => setDraft({ ...draft, source_links: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <label className="field-label">Notes</label>
          <Textarea
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
        <div>
          <Button onClick={add}>Add reference</Button>
        </div>
      </div>

      {refs.map((r) => (
        <div key={r.id} className="rounded border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium">{r.reference}</div>
              <div className="text-xs text-muted-foreground">
                {r.ref_type} · {labelOf(RESEARCH_STATUS, r.research_status)}
              </div>
            </div>
            <button
              onClick={async () => {
                await supabase.from("historical_references").delete().eq("id", r.id);
                qc.invalidateQueries({ queryKey: ["refs", letter.id] });
              }}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </button>
          </div>
          {r.description && <p className="mt-2 text-sm">{r.description}</p>}
          {r.notes && <p className="mt-1 text-sm text-muted-foreground">{r.notes}</p>}
          {r.source_links && (
            <p className="mt-1 text-xs break-all text-primary">{r.source_links}</p>
          )}
        </div>
      ))}
      {refs.length === 0 && (
        <p className="text-sm text-muted-foreground">No research references recorded.</p>
      )}
    </div>
  );
}

/* ---------------- Related letters ---------------- */

export function RelationsPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const { data: rels = [] } = useQuery({
    queryKey: ["relations", letter.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("letter_relations")
        .select("*, related:letters!letter_relations_related_letter_id_fkey(archive_id)")
        .eq("letter_id", letter.id);
      return data ?? [];
    },
  });
  const [target, setTarget] = useState("");
  const [type, setType] = useState<string>(RELATION_TYPES[0]);

  async function add() {
    if (!target) return;
    const { error } = await supabase.from("letter_relations").insert({
      letter_id: letter.id,
      related_letter_id: target,
      relation_type: type,
    });
    if (error) return toast.error(error.message);
    setTarget("");
    qc.invalidateQueries({ queryKey: ["relations", letter.id] });
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex gap-2">
        <select
          className="h-9 flex-1 rounded border border-input bg-background px-2 text-sm"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">Select letter…</option>
          {letters
            .filter((l) => l.id !== letter.id)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.archive_id} — {l.author ?? "?"} → {l.recipient ?? "?"}
              </option>
            ))}
        </select>
        <select
          className="h-9 rounded border border-input bg-background px-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {RELATION_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button onClick={add}>Link</Button>
      </div>
      <div className="divide-y divide-border rounded border border-border bg-card">
        {rels.map((r) => (
          <div key={r.id} className="flex items-center gap-4 px-3 py-2 text-sm">
            <Link
              to="/letters/$archiveId"
              params={{ archiveId: r.related?.archive_id ?? "" }}
              className="archive-id text-primary hover:underline"
            >
              {r.related?.archive_id}
            </Link>
            <span className="text-muted-foreground">{r.relation_type}</span>
            <button
              className="ml-auto"
              onClick={async () => {
                await supabase.from("letter_relations").delete().eq("id", r.id);
                qc.invalidateQueries({ queryKey: ["relations", letter.id] });
              }}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
        {rels.length === 0 && (
          <p className="px-3 py-3 text-sm text-muted-foreground">No related letters.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- AI analysis (placeholders) ---------------- */

export function AiPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["ai", letter.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_suggestions")
        .select("*")
        .eq("letter_id", letter.id)
        .order("created_at");
      return data ?? [];
    },
  });
  const [editing, setEditing] = useState<Record<string, string>>({});

  async function setStatus(id: string, status: string, content?: string) {
    await supabase
      .from("ai_suggestions")
      .update({ status, ...(content !== undefined ? { content } : {}) })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["ai", letter.id] });
    qc.invalidateQueries({ queryKey: ["ai_pending"] });
  }

  return (
    <div className="max-w-4xl space-y-4">
      <p className="rounded border border-archive-ai/40 bg-archive-ai-surface px-3 py-2 text-sm text-archive-ai">
        AI analysis is not connected yet. When an OCR/analysis service is added, its output lands
        here as pending suggestions — it never writes archival metadata directly.
      </p>
      {AI_FIELDS.map((f) => {
        const row = rows.find((r) => r.field_key === f.key);
        return (
          <div key={f.key} className="rounded border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="field-label">{f.label}</span>
              {row ? (
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    row.status === "accepted"
                      ? "bg-secondary text-secondary-foreground"
                      : row.status === "rejected"
                        ? "bg-muted text-muted-foreground"
                        : "bg-archive-ai-surface text-archive-ai"
                  }`}
                >
                  {row.status === "pending" ? "AI-GENERATED · awaiting review" : row.status}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No suggestion</span>
              )}
            </div>
            {row && (
              <>
                <Textarea
                  rows={3}
                  className="mt-2 text-sm"
                  value={editing[row.id] ?? row.content ?? ""}
                  onChange={(e) => setEditing({ ...editing, [row.id]: e.target.value })}
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => setStatus(row.id, "accepted")}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(row.id, "accepted", editing[row.id] ?? row.content ?? "")}
                  >
                    Edit &amp; Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(row.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Edit history ---------------- */

export function HistoryPanel({ letter }: { letter: Letter }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["history", letter.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("edit_history")
        .select("*")
        .eq("letter_id", letter.id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="max-w-4xl">
      <p className="mb-3 text-sm text-muted-foreground">
        Created {new Date(letter.created_at).toLocaleString()} · Last modified{" "}
        {new Date(letter.updated_at).toLocaleString()}
      </p>
      <div className="divide-y divide-border rounded border border-border bg-card text-sm">
        {rows.map((h) => (
          <div key={h.id} className="grid grid-cols-[10rem_9rem_1fr_1fr] gap-3 px-3 py-2">
            <span className="text-muted-foreground">
              {new Date(h.created_at).toLocaleString()}
            </span>
            <span className="font-medium">{h.field_key}</span>
            <span className="truncate text-muted-foreground line-through">{h.old_value}</span>
            <span className="truncate">{h.new_value}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-3 py-3 text-muted-foreground">No recorded changes yet.</p>
        )}
      </div>
    </div>
  );
}
