import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";
import { AliasManager } from "@/components/people/AliasManager";
import { DeletePersonButton } from "@/components/people/DeletePersonButton";
import { fetchLetters } from "@/lib/queries";
import { displayDate } from "@/lib/archive";

export const Route = createFileRoute("/_authenticated/people/$personId")({
  head: () => ({
    meta: [
      { title: "Person Record — The Francis Files" },
      {
        name: "description",
        content: "Biography, research notes and every associated letter for one person.",
      },
      { property: "og:title", content: "Person Record — The Francis Files" },
      {
        property: "og:description",
        content: "Biography, research notes and associated letters for one person.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PersonPage />
    </AppShell>
  ),
});

const FIELDS: { key: string; label: string; area?: boolean }[] = [
  { key: "name", label: "Name" },
  { key: "alternate_names", label: "Alternate names / nicknames" },
  { key: "relationship", label: "Relationship" },
  { key: "birth_date", label: "Birth date" },
  { key: "death_date", label: "Death date" },
  { key: "biographical_notes", label: "Biographical notes", area: true },
  { key: "research_notes", label: "Research notes", area: true },
];

function PersonPage() {
  const { personId } = Route.useParams();
  const qc = useQueryClient();
  const { data: person } = useQuery({
    queryKey: ["person", personId],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").eq("id", personId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const { data: mentions = [] } = useQuery({
    queryKey: ["person_letters", personId],
    queryFn: async () => {
      const { data } = await supabase
        .from("letter_people")
        .select("letter_id, role")
        .eq("person_id", personId);
      return data ?? [];
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (person) {
      const f: Record<string, string> = {};
      FIELDS.forEach((x) => (f[x.key] = (person as Record<string, string>)[x.key] ?? ""));
      setForm(f);
    }
  }, [person]);

  async function save() {
    const { error } = await supabase.from("people").update(form as never).eq("id", personId);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["person", personId] });
    qc.invalidateQueries({ queryKey: ["people"] });
  }

  if (!person) return <div className="p-4 sm:p-8 text-sm text-muted-foreground">Loading…</div>;

  const name = person.name as string;
  const written = letters.filter((l) => (l.author ?? "").toLowerCase() === name.toLowerCase());
  const received = letters.filter((l) => (l.recipient ?? "").toLowerCase() === name.toLowerCase());
  const mentionIds = mentions.map((m) => m.letter_id);
  const mentioned = letters.filter((l) => mentionIds.includes(l.id));

  const List = ({ title, rows }: { title: string; rows: typeof letters }) => (
    <div className="mb-6">
      <h3 className="field-label mb-2">
        {title} — {rows.length}
      </h3>
      <div className="divide-y divide-border rounded border border-border bg-card">
        {rows.map((l) => (
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
        {rows.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">None.</p>}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title={name}
        description="Person record"
        actions={
          <div className="flex gap-2">
            <DeletePersonButton personId={person.id} name={name} redirectAfter>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete person
              </Button>
            </DeletePersonButton>
            <Button onClick={save}>Save</Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-8 p-4 sm:p-8">
        <div className="space-y-4">
          {FIELDS.map((f) =>
            f.area ? (
              <div key={f.key}>
                <label className="field-label">{f.label}</label>
                <Textarea
                  rows={4}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ) : (
              <div key={f.key}>
                <label className="field-label">{f.label}</label>
                <Input
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ),
          )}
          <AliasManager personId={person.id} />
        </div>
        <div>
          <List title="Letters written by" rows={written} />
          <List title="Letters sent to" rows={received} />
          <List title="Letters mentioning" rows={mentioned} />
        </div>
      </div>
    </>
  );
}
