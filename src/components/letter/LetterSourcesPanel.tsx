import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Globe, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { dsTypeLabel, fetchLetterSources, type DigitalSource } from "@/lib/sources";
import type { Letter } from "@/lib/queries";

/** Digital Sources linked to this FH record (source side of the relationship). */
export function LetterSourcesPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const [dsId, setDsId] = useState("");
  const [explanation, setExplanation] = useState("");
  const qk = ["letterSources", letter.id];

  const { data: links = [] } = useQuery({
    queryKey: qk,
    queryFn: () => fetchLetterSources(letter.id),
  });
  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_sources")
        .select("*")
        .order("ds_seq", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DigitalSource[];
    },
  });
  const linkedIds = new Set(links.map((l) => l.source_id));
  const suggestions = sources.filter((s) => !linkedIds.has(s.id)).slice(0, 8);

  async function link(sourceId: string, label: string, note?: string) {
    const { error } = await supabase.from("letter_sources").insert({
      letter_id: letter.id,
      source_id: sourceId,
      explanation: note || null,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: qk });
    toast.success(`Linked ${label}`);
  }

  async function linkById() {
    const id = dsId.trim().toUpperCase();
    const source = sources.find((s) => s.ds_id === id);
    if (!source) return toast.error(`No digital source ${id}`);
    await link(source.id, id, explanation);
    setDsId("");
    setExplanation("");
  }

  async function unlink(linkId: string) {
    const { error } = await supabase.from("letter_sources").delete().eq("id", linkId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: qk });
  }

  return (
    <div className="max-w-3xl">
      <h3 className="field-label mb-3">Digital sources ({links.length})</h3>
      <div className="space-y-2">
        {links.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tone-teal-soft text-tone-teal">
              <Globe className="size-4" />
            </div>
            <Link
              to="/sources/$dsId"
              params={{ dsId: l.digital_sources?.ds_id ?? "" }}
              className="archive-id text-base text-tone-teal hover:underline"
            >
              {l.digital_sources?.ds_id}
            </Link>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {l.digital_sources?.title}
              </span>
              <span className="block text-xs text-muted-foreground">
                {l.digital_sources ? dsTypeLabel(l.digital_sources.source_type) : ""}
                {l.explanation ? ` — ${l.explanation}` : ""}
              </span>
            </div>
            {l.digital_sources?.url && (
              <a href={l.digital_sources.url} target="_blank" rel="noreferrer" className="text-tone-blue hover:underline">
                <ExternalLink className="size-3.5" />
              </a>
            )}
            <Button variant="ghost" size="icon" onClick={() => unlink(l.id)}>
              <X className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No digital sources linked. Link research material (videos, web archives, books) here.
          </p>
        )}
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-dashed border-border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-32"
            placeholder="DS-0001"
            value={dsId}
            onChange={(e) => setDsId(e.target.value)}
          />
          <Input
            className="min-w-60 flex-1"
            placeholder="Why is this source relevant? (optional)"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
          <Button size="sm" className="gap-1.5" onClick={linkById}>
            <Link2 className="size-3.5" /> Link source
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => link(s.id, s.ds_id)}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-tone-teal-soft hover:text-tone-teal"
              >
                {s.ds_id} · {s.title.slice(0, 40)}
                {s.title.length > 40 ? "…" : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
