import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { fetchLetters } from "@/lib/queries";
import { displayDate } from "@/lib/archive";

export const Route = createFileRoute("/places/$placeId")({
  head: () => ({
    meta: [
      { title: "Place Record — Harrington Letter Archive" },
      {
        name: "description",
        content: "Location details, coordinates, historical notes and associated letters.",
      },
      { property: "og:title", content: "Place Record — Harrington Letter Archive" },
      {
        property: "og:description",
        content: "Location details, coordinates and associated letters.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PlacePage />
    </AppShell>
  ),
});

const FIELDS: { key: string; label: string; area?: boolean }[] = [
  { key: "canonical_name", label: "Canonical name" },
  { key: "name_as_written", label: "Name as written" },
  { key: "city", label: "City" },
  { key: "region", label: "State / region" },
  { key: "country", label: "Country" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "historical_notes", label: "Historical notes", area: true },
  { key: "research_notes", label: "Research notes", area: true },
];

function PlacePage() {
  const { placeId } = Route.useParams();
  const qc = useQueryClient();
  const { data: place } = useQuery({
    queryKey: ["place", placeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("places").select("*").eq("id", placeId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const { data: links = [] } = useQuery({
    queryKey: ["place_letters", placeId],
    queryFn: async () => {
      const { data } = await supabase.from("letter_places").select("letter_id").eq("place_id", placeId);
      return (data ?? []).map((r) => r.letter_id as string);
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (place) {
      const f: Record<string, string> = {};
      FIELDS.forEach((x) => {
        const v = (place as Record<string, unknown>)[x.key];
        f[x.key] = v === null || v === undefined ? "" : String(v);
      });
      setForm(f);
    }
  }, [place]);

  async function save() {
    const payload: Record<string, unknown> = { ...form };
    payload.latitude = form.latitude ? Number(form.latitude) : null;
    payload.longitude = form.longitude ? Number(form.longitude) : null;
    const { error } = await supabase.from("places").update(payload as never).eq("id", placeId);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["place", placeId] });
  }

  if (!place) return <div className="p-4 sm:p-8 text-sm text-muted-foreground">Loading…</div>;

  const name = place.canonical_name as string;
  const related = letters.filter(
    (l) =>
      links.includes(l.id) ||
      (l.origin ?? "").toLowerCase() === name.toLowerCase() ||
      (l.destination ?? "").toLowerCase() === name.toLowerCase(),
  );

  return (
    <>
      <PageHeader title={name} description="Place record" actions={<Button onClick={save}>Save</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-8 p-4 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.area ? "col-span-full" : ""}>
              <label className="field-label">{f.label}</label>
              {f.area ? (
                <Textarea
                  rows={4}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <div>
          <h3 className="field-label mb-2">Associated letters — {related.length}</h3>
          <div className="divide-y divide-border rounded border border-border bg-card">
            {related.map((l) => (
              <Link
                key={l.id}
                to="/letters/$archiveId"
                params={{ archiveId: l.archive_id }}
                className="flex gap-4 px-3 py-2 text-sm hover:bg-muted/60"
              >
                <span className="archive-id text-primary">{l.archive_id}</span>
                <span className="text-muted-foreground">{displayDate(l)}</span>
              </Link>
            ))}
            {related.length === 0 && (
              <p className="px-3 py-3 text-xs text-muted-foreground">None.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
