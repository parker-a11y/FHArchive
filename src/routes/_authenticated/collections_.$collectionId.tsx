import { CollectionScansDialog } from "@/components/collections/CollectionScansDialog";
import { CollectionRecordTable } from "@/components/collections/CollectionRecordTable";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Settings, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  collectionsQuery,
  fetchCollectionRecords,
  applyCollections,
  searchCollectionText,
} from "@/lib/collections/client";
import {
  collectionDate,
  sortCollectionRecords,
  type CollectionRecord,
  type RecordKey,
} from "@/lib/collections/model";
import {
  AddCollectionRecordsDialog,
  AssignCollectionsDialog,
} from "@/components/collections/CollectionControls";
import { suggestCollectionItems, resumeCollectionDiscovery } from "@/lib/collections.functions";
export const Route = createFileRoute("/_authenticated/collections_/$collectionId")({
  loader: ({ context }) => context.queryClient.ensureQueryData(collectionsQuery),
  head: ({ params }) => ({
    meta: [
      { title: `Archive Collection ${params.collectionId.slice(0, 8)} — The Francis Files` },
      {
        name: "description",
        content:
          "Browse original records, overlapping labels and reviewed AI discovery in an archive collection.",
      },
      { property: "og:title", content: "Archive Collection — The Francis Files" },
      {
        property: "og:description",
        content: "Chronological records and evidence-grounded collection suggestions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollectionPage,
});
function OriginalLink({ record: r }: { record: CollectionRecord }) {
  const cls = "text-primary hover:underline font-mono font-semibold";
  return r.kind === "photo" ? (
    <Link className={cls} to="/photos/$phId" params={{ phId: r.identifier }}>
      {r.identifier}
    </Link>
  ) : r.kind === "source" ? (
    <Link className={cls} to="/sources/$dsId" params={{ dsId: r.identifier }}>
      {r.identifier}
    </Link>
  ) : (
    <Link className={cls} to="/letters/$archiveId" params={{ archiveId: r.identifier }}>
      {r.identifier}
    </Link>
  );
}
function CollectionPage() {
  const { collectionId } = Route.useParams();
  const { data } = useSuspenseQuery(collectionsQuery);
  const collection = data.collections.find((c) => c.id === collectionId);
  const { canEdit, isAdmin } = useAuth();
  const qc = useQueryClient(),
    navigate = useNavigate();
  const {
    data: records = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ["collection-records", collectionId],
    queryFn: () => fetchCollectionRecords(collectionId),
  });
  const [q, setQ] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [type, setType] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [sort, setSort] = useState("date"),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [editOpen, setEditOpen] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [suggesting, setSuggesting] = useState(false),
    [review, setReview] = useState(false),
    [showDismissed, setShowDismissed] = useState(false),
    [approved, setApproved] = useState<Set<string>>(new Set());
  const suggest = useServerFn(suggestCollectionItems);
  const resume = useServerFn(resumeCollectionDiscovery);
  const { data: aiState } = useQuery({
    queryKey: ["collection-ai-state"],
    enabled: canEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_discovery_state")
        .select("*")
        .eq("key", "gateway")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: textMatches = [] } = useQuery({
    queryKey: ["collection-text-search", collectionId, q],
    enabled: Boolean(q.trim()),
    queryFn: () => searchCollectionText(collectionId, q),
  });
  const { data: suggestions = [], error: suggestionError } = useQuery({
    queryKey: ["collection-suggestions", collectionId],
    enabled: canEdit,
    queryFn: async () => {
      const all = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("collection_suggestions")
          .select("*")
          .eq("collection_id", collectionId)
          .order("created_at", { ascending: false })
          .range(offset, offset + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
      }
      return all;
    },
  });
  const { data: suggestionRecords = [] } = useQuery({
    queryKey: ["collection-suggestion-records", suggestions.map((s) => s.ref_id)],
    enabled: suggestions.length > 0,
    queryFn: async () => {
      const all: CollectionRecord[] = [];
      for (const kind of ["letter", "photo", "source"] as const) {
        const ids = suggestions.filter((s) => s.kind === kind).map((s) => s.ref_id);
        for (let i = 0; i < ids.length; i += 200) {
          const { data, error } = await supabase
            .from("collection_archive_records")
            .select(
              "kind,ref_id,identifier,title,record_type,sort_date,date_text,author,recipient,origin,destination",
            )
            .eq("kind", kind)
            .in("ref_id", ids.slice(i, i + 200));
          if (error) throw error;
          all.push(...((data ?? []) as CollectionRecord[]));
        }
      }
      return all;
    },
  });
  if (!collection)
    return (
      <AppShell>
        <PageHeader title="Collection unavailable" />
        <div className="p-8">
          <Link to="/collections">Back to Collections</Link>
        </div>
      </AppShell>
    );
  const visible = sortCollectionRecords(
    records.filter(
      (r) =>
        (!q ||
          [r.identifier, r.title, r.author, r.recipient, r.origin, r.destination]
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase()) ||
          textMatches.includes(`${r.kind}:${r.ref_id}`)) &&
        (!from || (r.author ?? "").toLowerCase().includes(from.toLowerCase())) &&
        (!to || (r.recipient ?? "").toLowerCase().includes(to.toLowerCase())) &&
        (!type || r.record_type === type) &&
        (!start || Boolean(r.sort_date && r.sort_date >= start)) &&
        (!end || Boolean(r.sort_date && r.sort_date <= end)),
    ),
    sort,
  );
  const chosen = records
    .filter((r) => selected.has(`${r.kind}:${r.ref_id}`))
    .map((r) => ({ kind: r.kind, id: r.ref_id }));
  const memberKeys = new Set(
    data.memberships
      .filter((m) => m.collection_id === collectionId)
      .map((m) => `${m.kind}:${m.ref_id}`),
  );
  const visibleSuggestions = suggestions
    .filter(
      (s) =>
        s.dismissed === showDismissed &&
        !memberKeys.has(`${s.kind}:${s.ref_id}`) &&
        suggestionRecords.some((r) => r.kind === s.kind && r.ref_id === s.ref_id),
    )
    .sort(
      (a, b) =>
        ["High", "Medium", "Low"].indexOf(a.confidence) -
        ["High", "Medium", "Low"].indexOf(b.confidence),
    );
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["collections"] }),
      qc.invalidateQueries({ queryKey: ["collection-records"] }),
      qc.invalidateQueries({ queryKey: ["collection-suggestions"] }),
    ]);
  }
  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("collections")
        .update({ name: name.trim(), description })
        .eq("id", collectionId);
      if (error) throw error;
      await refresh();
      setEditOpen(false);
      toast.success("Collection updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeCollection() {
    try {
      const { error } = await supabase.from("collections").delete().eq("id", collectionId);
      if (error) throw error;
      await refresh();
      await navigate({ to: "/collections" });
      toast.success("Collection deleted; original records preserved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function removeRecords() {
    setBusy(true);
    try {
      await applyCollections([collectionId], chosen, true);
      await refresh();
      setSelected(new Set());
      toast.success("Labels removed; original records preserved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function discover() {
    setSuggesting(true);
    setReview(true);
    try {
      const result = await suggest({ data: { collectionId } });
      await refresh();
      toast.success(
        result.count ? `${result.count} recommendations ready for review` : "No new matches found",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }
  async function dismiss(id: string, value: boolean) {
    try {
      const { error } = await supabase
        .from("collection_suggestions")
        .update({ dismissed: value })
        .eq("id", id);
      if (error) throw error;
      setApproved((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function accept() {
    setBusy(true);
    try {
      const keys: RecordKey[] = visibleSuggestions
        .filter((s) => approved.has(s.id))
        .map((s) => ({ kind: s.kind as RecordKey["kind"], id: s.ref_id }));
      await applyCollections([collectionId], keys);
      await refresh();
      setApproved(new Set());
      toast.success(`${keys.length} records added`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell>
      <PageHeader
        title={collection.name}
        description={collection.description || undefined}
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <AddCollectionRecordsDialog collectionId={collectionId} />
              <Button
                className="gap-2"
                onClick={discover}
                disabled={suggesting || Boolean(aiState?.reason)}
              >
                <Sparkles className="size-4" />
                {suggesting ? "Finding matches…" : "Suggest New Items"}
              </Button>
              <Dialog
                open={editOpen}
                onOpenChange={(v) => {
                  setEditOpen(v);
                  if (v) {
                    setName(collection.name);
                    setDescription(collection.description);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Edit collection"
                    title="Edit collection"
                  >
                    <Settings className="size-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit collection</DialogTitle>
                    <DialogDescription>Name and description</DialogDescription>
                  </DialogHeader>
                  <Input
                    aria-label="Collection name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={160}
                  />
                  <Textarea
                    aria-label="Collection description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <Button disabled={busy || !name.trim()} onClick={save}>
                    Save
                  </Button>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Delete collection"
                    title="Delete collection"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {collection.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Only this collection, its labels and suggestion history will be removed. All
                      original archive records, transcriptions, images and numbers will remain
                      unchanged.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={removeCollection}>
                      Delete collection
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : undefined
        }
      />
      <div className="p-4 sm:p-8">
        <Link to="/collections" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="size-3" />
          Collections
        </Link>
        <div className="my-4 flex flex-wrap items-center gap-3">
          <strong>{records.length} records</strong>
          {canEdit && suggestions.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setReview(!review)}>
              {review ? "Return to collection" : "Review suggestions"}
            </Button>
          )}
        </div>
        {aiState?.reason && (
          <div className="mb-4 space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {aiState.reason}
            </p>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Resume AI discovery only after AI access or credits have been restored?",
                    )
                  )
                    return;
                  try {
                    await resume();
                    await qc.invalidateQueries({ queryKey: ["collection-ai-state"] });
                    toast.success("AI discovery resumed. Start a fresh search when ready.");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Resume after access is restored
              </Button>
            )}
          </div>
        )}
        {review && canEdit ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl">Suggested for {collection.name}</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDismissed(!showDismissed);
                  setApproved(new Set());
                }}
              >
                {showDismissed ? "View suggestions" : "Review dismissed"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setReview(false)}>
                Return without changes
              </Button>
            </div>
            {suggesting && (
              <p role="status">Finding related archive passages and reviewing the evidence…</p>
            )}
            {suggestionError && <p role="alert">{suggestionError.message}</p>}
            {!suggesting && !visibleSuggestions.length && (
              <p className="text-muted-foreground">
                No {showDismissed ? "dismissed" : "pending"} suggestions.
              </p>
            )}
            {!showDismissed && visibleSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <Checkbox
                    aria-label="Select all visible suggestions"
                    checked={visibleSuggestions.every((s) => approved.has(s.id))}
                    onCheckedChange={(v) =>
                      setApproved(v ? new Set(visibleSuggestions.map((s) => s.id)) : new Set())
                    }
                  />
                  Select all visible
                </label>
                <Button onClick={accept} disabled={!approved.size || busy}>
                  Add selected records ({approved.size})
                </Button>
              </div>
            )}
            {visibleSuggestions.map((s) => {
              const r = suggestionRecords.find((r) => r.kind === s.kind && r.ref_id === s.ref_id);
              if (!r) return null;
              return (
                <article key={s.id} className="rounded-md border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {!showDismissed && (
                      <Checkbox
                        aria-label={`Approve ${r.identifier}`}
                        checked={approved.has(s.id)}
                        onCheckedChange={(v) =>
                          setApproved((p) => {
                            const n = new Set(p);
                            if (v) n.add(s.id);
                            else n.delete(s.id);
                            return n;
                          })
                        }
                      />
                    )}
                    <OriginalLink record={r} />
                    <span className="text-sm">{collectionDate(r)}</span>
                    <span className="rounded border border-border bg-muted px-2 py-0.5 text-xs">
                      {s.confidence} confidence
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">
                    {[r.author, r.recipient].filter(Boolean).join(" → ") || r.title}
                  </p>
                  {s.excerpt && (
                    <blockquote className="my-3 border-l-2 border-border pl-3 text-sm text-muted-foreground whitespace-pre-wrap">
                      {s.excerpt}
                    </blockquote>
                  )}
                  <p className="text-sm">{s.reason}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => dismiss(s.id, !s.dismissed)}
                  >
                    {showDismissed ? "Reconsider" : "Dismiss"}
                  </Button>
                </article>
              );
            })}
          </section>
        ) : (
          <>
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                aria-label="Search within collection"
                placeholder="Search collection…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Input
                aria-label="Filter sender"
                placeholder="From"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                aria-label="Filter recipient"
                placeholder="To"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <select
                aria-label="Record type"
                className="h-9 rounded border border-input bg-background px-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">All record types</option>
                {[...new Set(records.map((r) => r.record_type).filter(Boolean))].map((t) => (
                  <option key={t} value={t ?? ""}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="text-xs">
                From date
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="text-xs">
                Through date
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <label className="text-xs">
                Sort
                <select
                  aria-label="Sort collection"
                  className="block h-9 w-full rounded border border-input bg-background px-2 text-sm"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="date">Chronological</option>
                  <option value="newest">Newest first</option>
                  <option value="number">Record number</option>
                  <option value="title">Title</option>
                </select>
              </label>
            </div>
            {canEdit && visible.length > 0 && (
              <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 border-y border-border bg-background py-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    aria-label="Select visible records"
                    checked={visible.every((r) => selected.has(`${r.kind}:${r.ref_id}`))}
                    onCheckedChange={(v) =>
                      setSelected((p) => {
                        const n = new Set(p);
                        for (const r of visible) {
                          const k = `${r.kind}:${r.ref_id}`;
                          if (v) n.add(k);
                          else n.delete(k);
                        }
                        return n;
                      })
                    }
                  />
                  Select visible
                </label>
                {chosen.length > 0 && (
                  <>
                    <span className="text-sm">{chosen.length} selected</span>
                    <AssignCollectionsDialog records={chosen} />
                    <CollectionScansDialog records={records.filter((r) => r.kind === "letter" && selected.has(`${r.kind}:${r.ref_id}`)).map((r) => ({ id: r.ref_id, identifier: r.identifier }))} />
                    <Button variant="outline" size="sm" disabled={busy} onClick={removeRecords}>
                      Remove from collection
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                      Clear
                    </Button>
                  </>
                )}
              </div>
            )}
            {error && <p role="alert">{error.message}</p>}
            {isLoading && <p>Loading records…</p>}
            {!isLoading && !visible.length && (
              <p className="py-12 text-muted-foreground">No records in this view.</p>
            )}
            <CollectionRecordTable records={visible} selected={selected} setSelected={setSelected} collectionSort={sort} />
          </>
        )}
      </div>
    </AppShell>
  );
}
