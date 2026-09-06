import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import {
  categoryLabel,
  createNote,
  fetchAllAliases,
  fetchNotes,
  findSimilarNotes,
  mergeNotes,
  noteTitle,
  normAlias,
  updateNote,
  type FfnNote,
} from "@/lib/ffn";

export const Route = createFileRoute("/_authenticated/admin/notes/")({
  head: () => ({
    meta: [
      { title: "Francis File Notes — Admin" },
      {
        name: "description",
        content:
          "Create, edit and publish the archive's Francis File Notes: the reusable knowledge entries recognised throughout the Francis Files.",
      },
      { property: "og:title", content: "Francis File Notes — Admin" },
      { property: "og:description", content: "Manage the archive's knowledge entries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <NotesAdmin />
    </AppShell>
  ),
});

type Filter = "all" | "published" | "draft" | "autolink" | "no_image" | "no_context";

function NotesAdmin() {
  const { loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [dupes, setDupes] = useState<FfnNote[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [mergeFrom, setMergeFrom] = useState<string>("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["ffn-notes", "all"],
    queryFn: () => fetchNotes({ includeDrafts: true }),
  });
  const { data: aliases = [] } = useQuery({ queryKey: ["ffn-aliases"], queryFn: fetchAllAliases });

  const aliasCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of aliases) m[a.note_id] = (m[a.note_id] ?? 0) + 1;
    return m;
  }, [aliases]);

  const shown = useMemo(() => {
    const key = normAlias(q);
    return notes.filter((n) => {
      if (key && !normAlias(`${n.term} ${n.title ?? ""} ${n.expanded_name ?? ""}`).includes(key))
        return false;
      if (filter === "published") return n.status === "published";
      if (filter === "draft") return n.status === "draft";
      if (filter === "autolink") return n.auto_link;
      if (filter === "no_context") return !n.archive_context?.trim();
      return true;
    });
  }, [notes, q, filter]);

  async function create(force = false) {
    const clean = term.trim();
    if (!clean) return;
    setBusy(true);
    try {
      if (!force) {
        const similar = await findSimilarNotes(clean);
        if (similar.length) {
          setDupes(similar);
          return;
        }
      }
      const note = await createNote({ term: clean, title: clean });
      setTerm("");
      setDupes(null);
      qc.invalidateQueries({ queryKey: ["ffn-notes"] });
      navigate({ to: "/admin/notes/$noteId", params: { noteId: note.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the note");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(n: FfnNote) {
    await updateNote(n.id, { status: n.status === "published" ? "draft" : "published" });
    qc.invalidateQueries({ queryKey: ["ffn-notes"] });
    qc.invalidateQueries({ queryKey: ["ffn-alias-index"] });
    toast.success(n.status === "published" ? "Moved back to draft" : "Published");
  }

  async function doMerge(target: FfnNote) {
    if (!mergeFrom || mergeFrom === target.id) return;
    if (!confirm(`Merge that note into ${noteTitle(target)}? The other note is removed.`)) return;
    try {
      await mergeNotes(target.id, mergeFrom);
      setMergeFrom("");
      qc.invalidateQueries({ queryKey: ["ffn-notes"] });
      toast.success("Notes merged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed");
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <PageHeader
        title="Francis File Notes"
        description="Reusable knowledge entries. Published notes are recognised throughout the archive."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/notes">View public index</Link>
          </Button>
        }
      />

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">New Francis File Note</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setDupes(null);
            }}
            placeholder="Term, e.g. YMS"
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button disabled={busy || !term.trim()} onClick={() => create()}>
            Create
          </Button>
        </div>
        {dupes && dupes.length > 0 && (
          <div className="mt-3 rounded border border-archive-gold/50 bg-muted/40 p-3 text-sm">
            <p className="font-medium">Possible existing Francis File Note</p>
            <ul className="mt-1 space-y-1">
              {dupes.map((d) => (
                <li key={d.id}>
                  <Link
                    to="/admin/notes/$noteId"
                    params={{ noteId: d.id }}
                    className="text-primary hover:underline"
                  >
                    {noteTitle(d)} {d.expanded_name ? `— ${d.expanded_name}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => create(true)}>
              Continue creating new note
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes"
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["published", "Published"],
              ["draft", "Draft"],
              ["autolink", "Auto-link on"],
              ["no_context", "Missing archive context"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs tracking-wide uppercase">
              <tr>
                <th className="p-2">Term</th>
                <th className="p-2">Expanded name</th>
                <th className="p-2">Category</th>
                <th className="p-2">Aliases</th>
                <th className="p-2">Appearances</th>
                <th className="p-2">Status</th>
                <th className="p-2">Auto-link</th>
                <th className="p-2">Updated</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((n) => (
                <tr key={n.id} className="hover:bg-muted/30">
                  <td className="p-2 font-medium">
                    <Link
                      to="/admin/notes/$noteId"
                      params={{ noteId: n.id }}
                      className="text-primary hover:underline"
                    >
                      {noteTitle(n)}
                    </Link>
                  </td>
                  <td className="p-2 text-muted-foreground">{n.expanded_name}</td>
                  <td className="p-2">{categoryLabel(n.category)}</td>
                  <td className="p-2">{aliasCount[n.id] ?? 0}</td>
                  <td className="p-2">{n.appearance_count}</td>
                  <td className="p-2">
                    <span
                      className={
                        n.status === "published"
                          ? "font-medium text-archive-gold-strong"
                          : "text-muted-foreground"
                      }
                    >
                      {n.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="p-2">{n.auto_link ? "On" : "Off"}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {new Date(n.updated_at).toLocaleDateString()}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => togglePublish(n)}>
                        {n.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                      {mergeFrom && mergeFrom !== n.id ? (
                        <Button size="sm" variant="outline" onClick={() => doMerge(n)}>
                          Merge into this
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMergeFrom(mergeFrom === n.id ? "" : n.id)}
                        >
                          {mergeFrom === n.id ? "Cancel merge" : "Merge…"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mergeFrom && (
        <p className="text-xs text-muted-foreground">
          Merging: choose the note to keep by pressing “Merge into this”.
        </p>
      )}
    </div>
  );
}
