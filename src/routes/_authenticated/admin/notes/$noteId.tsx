import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Trash2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { draftFrancisFileNote } from "@/lib/ffn.functions";
import {
  addAlias,
  addImage,
  deleteNote,
  fetchAliases,
  fetchImages,
  fetchNote,
  fetchNotes,
  fetchOccurrences,
  fetchRelatedNotes,
  findArchiveMatches,
  linkNotes,
  noteTitle,
  removeAlias,
  removeImage,
  saveArchiveMatches,
  setAliasAutoLink,
  slugify,
  unlinkNotes,
  updateNote,
  FFN_CATEGORIES,
  type ArchiveMatch,
} from "@/lib/ffn";

export const Route = createFileRoute("/_authenticated/admin/notes/$noteId")({
  head: () => ({
    meta: [
      { title: "Edit Francis File Note — Admin" },
      {
        name: "description",
        content:
          "Edit a Francis File Note: definition, historical background, archive context, aliases, images and archive appearances.",
      },
      { property: "og:title", content: "Edit Francis File Note" },
      { property: "og:description", content: "Edit an archive knowledge entry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <NoteEditor />
    </AppShell>
  ),
});

function NoteEditor() {
  const { noteId } = Route.useParams();
  const { loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const draft = useServerFn(draftFrancisFileNote);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  const { data: note, isLoading } = useQuery({
    queryKey: ["ffn-note", noteId],
    queryFn: () => fetchNote(noteId),
  });
  const { data: aliases = [] } = useQuery({
    queryKey: ["ffn-aliases", noteId],
    queryFn: () => fetchAliases(noteId),
  });
  const { data: images = [] } = useQuery({
    queryKey: ["ffn-images", noteId],
    queryFn: () => fetchImages(noteId),
  });
  const { data: related = [] } = useQuery({
    queryKey: ["ffn-related", noteId],
    queryFn: () => fetchRelatedNotes(noteId),
  });
  const { data: occurrences = [] } = useQuery({
    queryKey: ["ffn-occurrences", noteId],
    queryFn: () => fetchOccurrences(noteId),
  });
  const { data: allNotes = [] } = useQuery({
    queryKey: ["ffn-notes", "all"],
    queryFn: () => fetchNotes({ includeDrafts: true }),
  });

  const [form, setForm] = useState({
    term: "",
    title: "",
    expanded_name: "",
    category: "other",
    short_definition: "",
    background: "",
    archive_context: "",
    sources: "",
    slug: "",
    auto_link: true,
    status: "draft" as "draft" | "published",
  });
  const [newAlias, setNewAlias] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [imgCaption, setImgCaption] = useState("");
  const [imgCredit, setImgCredit] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<ArchiveMatch[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!note) return;
    setForm({
      term: note.term,
      title: note.title ?? "",
      expanded_name: note.expanded_name ?? "",
      category: note.category,
      short_definition: note.short_definition ?? "",
      background: note.background ?? "",
      archive_context: note.archive_context ?? "",
      sources: note.sources ?? "",
      slug: note.slug,
      auto_link: note.auto_link,
      status: note.status,
    });
  }, [note]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save(extra: Partial<typeof form> = {}) {
    setSaving(true);
    try {
      const next = { ...form, ...extra };
      await updateNote(noteId, {
        ...next,
        slug: slugify(next.slug || next.title || next.term),
      });
      qc.invalidateQueries({ queryKey: ["ffn-note", noteId] });
      qc.invalidateQueries({ queryKey: ["ffn-notes"] });
      qc.invalidateQueries({ queryKey: ["ffn-alias-index"] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function generate(section?: string) {
    setAiBusy(true);
    try {
      const result = await draft({
        data: {
          term: form.term,
          context: [form.expanded_name, form.short_definition, form.archive_context]
            .filter(Boolean)
            .join("\n"),
          section,
        },
      });
      setForm((f) => ({
        ...f,
        expanded_name: result.expanded_name?.trim() ? result.expanded_name : f.expanded_name,
        category: result.category && !section ? result.category : f.category,
        short_definition: result.short_definition?.trim()
          ? result.short_definition
          : f.short_definition,
        background: result.background?.trim() ? result.background : f.background,
        archive_context: result.archive_context?.trim()
          ? result.archive_context
          : f.archive_context,
        sources: result.sources?.trim() ? result.sources : f.sources,
      }));
      if (!section && result.aliases?.length) {
        for (const alias of result.aliases) await addAlias(noteId, alias, false).catch(() => {});
        qc.invalidateQueries({ queryKey: ["ffn-aliases", noteId] });
      }
      toast.success("Draft written — review and edit before publishing");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI drafting failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function scanArchive() {
    setScanning(true);
    try {
      const terms = [form.term, form.expanded_name, ...aliases.map((a) => a.alias)].filter(Boolean);
      const found = await findArchiveMatches(terms);
      setMatches(found);
      setPicked(new Set(found.map((m) => `${m.kind}:${m.refId}`)));
      if (!found.length) toast.info("No archive mentions found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setScanning(false);
    }
  }

  async function confirmMatches() {
    if (!matches) return;
    const keep = matches.filter((m) => picked.has(`${m.kind}:${m.refId}`));
    await saveArchiveMatches(noteId, keep);
    setMatches(null);
    qc.invalidateQueries({ queryKey: ["ffn-occurrences", noteId] });
    qc.invalidateQueries({ queryKey: ["ffn-note", noteId] });
    toast.success(`${keep.length} appearances recorded`);
  }

  if (isLoading) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!note) return <p className="p-8 text-sm">No note found.</p>;

  return (
    <div className="space-y-6 p-4 pb-24 sm:p-8">
      <PageHeader
        title={noteTitle(note)}
        description="Francis File Note"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/notes">All notes</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                save({ status: form.status === "published" ? "draft" : "published" }).then(() =>
                  set("status", form.status === "published" ? "draft" : "published"),
                )
              }
            >
              {form.status === "published" ? "Unpublish" : "Publish"}
            </Button>
            <Button size="sm" disabled={saving} onClick={() => save()}>
              Save changes
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Term</Label>
          <Input value={form.term} onChange={(e) => set("term", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Expanded name</Label>
          <Input
            value={form.expanded_name}
            onChange={(e) => set("expanded_name", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Display title</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FFN_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Web address</Label>
          <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="auto_link"
            checked={form.auto_link}
            onCheckedChange={(v) => set("auto_link", v)}
          />
          <Label htmlFor="auto_link">Highlight this term throughout the archive</Label>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Content</p>
          <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => generate()}>
            <Sparkles className="mr-1.5 size-4" />
            {aiBusy ? "Writing…" : "Draft with AI"}
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label>Short definition</Label>
          <Textarea
            rows={2}
            value={form.short_definition}
            onChange={(e) => set("short_definition", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Historical background</Label>
            <Button
              size="sm"
              variant="ghost"
              disabled={aiBusy}
              onClick={() => generate("background")}
            >
              Rewrite
            </Button>
          </div>
          <Textarea
            rows={8}
            value={form.background}
            onChange={(e) => set("background", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Why this matters in the Francis Files</Label>
            <Button
              size="sm"
              variant="ghost"
              disabled={aiBusy}
              onClick={() => generate("archive_context")}
            >
              Rewrite
            </Button>
          </div>
          <Textarea
            rows={5}
            value={form.archive_context}
            onChange={(e) => set("archive_context", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Sources</Label>
          <Textarea rows={3} value={form.sources} onChange={(e) => set("sources", e.target.value)} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Alternate names and spellings</p>
        <p className="text-xs text-muted-foreground">
          Each spelling can be highlighted in the archive on its own. Turn highlighting off for
          words that are too common or ambiguous.
        </p>
        <ul className="divide-y rounded border">
          {aliases.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 p-2 text-sm">
              <span>{a.alias}</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Switch
                    checked={a.auto_link}
                    onCheckedChange={async (v) => {
                      await setAliasAutoLink(a.id, v);
                      qc.invalidateQueries({ queryKey: ["ffn-aliases", noteId] });
                      qc.invalidateQueries({ queryKey: ["ffn-alias-index"] });
                    }}
                  />
                  Highlight
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await removeAlias(a.id);
                    qc.invalidateQueries({ queryKey: ["ffn-aliases", noteId] });
                    qc.invalidateQueries({ queryKey: ["ffn-alias-index"] });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
          {aliases.length === 0 && (
            <li className="p-2 text-sm text-muted-foreground">No alternate names yet.</li>
          )}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder="Add an alternate name"
          />
          <Button
            variant="outline"
            onClick={async () => {
              if (!newAlias.trim()) return;
              await addAlias(noteId, newAlias.trim());
              setNewAlias("");
              qc.invalidateQueries({ queryKey: ["ffn-aliases", noteId] });
              qc.invalidateQueries({ queryKey: ["ffn-alias-index"] });
            }}
          >
            Add
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Images</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <figure key={img.id} className="space-y-1">
              {img.image_url && (
                <img
                  src={img.image_url}
                  alt={img.caption ?? form.term}
                  className="w-full rounded border"
                />
              )}
              <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{img.caption || img.credit || "Image"}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await removeImage(img.id);
                    qc.invalidateQueries({ queryKey: ["ffn-images", noteId] });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="Image link" />
          <Input
            value={imgCaption}
            onChange={(e) => setImgCaption(e.target.value)}
            placeholder="Caption"
          />
          <Input
            value={imgCredit}
            onChange={(e) => setImgCredit(e.target.value)}
            placeholder="Credit / rights"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (!imgUrl.trim()) return;
            await addImage(noteId, {
              image_url: imgUrl.trim(),
              caption: imgCaption.trim() || null,
              credit: imgCredit.trim() || null,
              is_primary: images.length === 0,
            });
            setImgUrl("");
            setImgCaption("");
            setImgCredit("");
            qc.invalidateQueries({ queryKey: ["ffn-images", noteId] });
          }}
        >
          Add image
        </Button>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Related Francis File Notes</p>
        <div className="flex flex-wrap gap-1.5">
          {related.map((r) => (
            <button
              key={r.id}
              className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/70"
              onClick={async () => {
                await unlinkNotes(noteId, r.id);
                qc.invalidateQueries({ queryKey: ["ffn-related", noteId] });
              }}
              title="Remove link"
            >
              {noteTitle(r)} ×
            </button>
          ))}
          {related.length === 0 && (
            <span className="text-sm text-muted-foreground">None linked yet.</span>
          )}
        </div>
        <Select
          value=""
          onValueChange={async (v) => {
            await linkNotes(noteId, v);
            qc.invalidateQueries({ queryKey: ["ffn-related", noteId] });
          }}
        >
          <SelectTrigger className="sm:max-w-xs">
            <SelectValue placeholder="Link another note" />
          </SelectTrigger>
          <SelectContent>
            {allNotes
              .filter((n) => n.id !== noteId && !related.some((r) => r.id === n.id))
              .map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {noteTitle(n)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Archive appearances</p>
            <p className="text-xs text-muted-foreground">
              {occurrences.length} recorded {occurrences.length === 1 ? "record" : "records"}
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={scanning} onClick={scanArchive}>
            {scanning ? "Searching…" : "Find in archive"}
          </Button>
        </div>

        {matches && (
          <div className="space-y-2 rounded border bg-muted/30 p-3">
            <p className="text-sm font-medium">{matches.length} possible mentions — confirm</p>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {matches.map((m) => {
                const key = `${m.kind}:${m.refId}`;
                return (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={picked.has(key)}
                      onCheckedChange={(v) =>
                        setPicked((p) => {
                          const next = new Set(p);
                          v ? next.add(key) : next.delete(key);
                          return next;
                        })
                      }
                    />
                    <div>
                      <span className="font-medium">{m.label}</span>
                      {m.excerpt && (
                        <span className="text-muted-foreground"> — “{m.excerpt}”</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmMatches}>
                Save confirmed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMatches(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {occurrences.length > 0 && (
          <ul className="divide-y rounded border">
            {occurrences.slice(0, 50).map((o) => (
              <li key={o.id} className="p-2 text-sm">
                <span className="font-medium">{o.ref_label}</span>
                {o.excerpt && (
                  <span className="text-muted-foreground"> — “{o.excerpt}”</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            if (!confirm("Delete this Francis File Note permanently?")) return;
            await deleteNote(noteId);
            navigate({ to: "/admin/notes" });
          }}
        >
          Delete note
        </Button>
      </div>
    </div>
  );
}
