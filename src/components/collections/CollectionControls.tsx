import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tags, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { useAuth } from "@/hooks/useAuth";
import {
  collectionsQuery,
  createCollection,
  applyCollections,
  fetchRecordOptions,
} from "@/lib/collections/client";
import { type RecordKey, recordKey } from "@/lib/collections/model";
export function CreateCollectionDialog() {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function save() {
    setBusy(true);
    try {
      await createCollection(name, description);
      await qc.invalidateQueries({ queryKey: ["collections"] });
      setOpen(false);
      setName("");
      setDescription("");
      toast.success("Collection created");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Create Collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>Choose a name and optional description.</DialogDescription>
        </DialogHeader>
        <label className="space-y-1">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
        </label>
        <label className="space-y-1">
          Description
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <Button onClick={save} disabled={!name.trim() || busy}>
          {busy ? "Creating…" : "Create"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
export function CollectionLabels({ record }: { record: RecordKey }) {
  const { data } = useQuery(collectionsQuery);
  const [expanded, setExpanded] = useState(false);
  const ids = new Set(
    data?.memberships
      .filter((m) => m.kind === record.kind && m.ref_id === record.id)
      .map((m) => m.collection_id),
  );
  const labels = data?.collections.filter((c) => ids.has(c.id)) ?? [];
  if (!labels.length) return null;
  return (
    <div className="flex w-full flex-wrap items-center gap-1 py-1" aria-label="Collection labels">
      {(expanded ? labels : labels.slice(0, 2)).map((c) => (
        <Link
          key={c.id}
          to="/collections/$collectionId"
          params={{ collectionId: c.id }}
          className="max-w-48 truncate rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {c.name}
        </Link>
      ))}
      {labels.length > 2 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Less" : `+${labels.length - 2}`}
        </Button>
      )}
    </div>
  );
}
export function AssignCollectionsDialog({ records }: { records: RecordKey[] }) {
  const { canEdit } = useAuth();
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [name, setName] = useState(""),
    [picked, setPicked] = useState<Set<string>>(new Set()),
    [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { data, isError } = useQuery(collectionsQuery);
  if (!canEdit || !records.length) return null;
  async function apply(remove: boolean) {
    setBusy(true);
    try {
      await applyCollections([...picked], records, remove);
      await qc.invalidateQueries({ queryKey: ["collections"] });
      await qc.invalidateQueries({ queryKey: ["collection-records"] });
      toast.success(
        `${remove ? "Removed" : "Added"} labels for ${records.length} record${records.length === 1 ? "" : "s"}`,
      );
      setOpen(false);
      setPicked(new Set());
    } catch (e) {
      toast.error((e as Error).message);
      await qc.invalidateQueries({ queryKey: ["collections"] });
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    setBusy(true);
    try {
      const c = await createCollection(name);
      setPicked((p) => new Set([...p, c.id]));
      setName("");
      await qc.invalidateQueries({ queryKey: ["collections"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tags className="size-4" />
          Add to Collection{records.length > 1 ? ` (${records.length})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collection labels · {records.length} selected</DialogTitle>
          <DialogDescription>
            Add or remove labels; original records stay unchanged.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Search collections"
          placeholder="Search collections…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {isError && <p role="alert">Could not load collections.</p>}
          {data?.collections
            .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
            .map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded border border-border p-2"
              >
                <Checkbox
                  checked={picked.has(c.id)}
                  onCheckedChange={(v) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (v) n.add(c.id);
                      else n.delete(c.id);
                      return n;
                    })
                  }
                />
                <span className="min-w-0 break-words">{c.name}</span>
              </label>
            ))}
        </div>
        <div className="flex gap-2">
          <Input
            aria-label="New collection name"
            placeholder="New collection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={160}
          />
          <Button variant="outline" onClick={create} disabled={busy || !name.trim()}>
            <Plus className="size-4" />
            Create
          </Button>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={!picked.size || busy} onClick={() => apply(true)}>
            Remove labels
          </Button>
          <Button disabled={!picked.size || busy} onClick={() => apply(false)}>
            {busy ? "Saving…" : "Add selected labels"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function RecordCollections({ record }: { record: RecordKey }) {
  return (
    <section className="my-4 space-y-2 border-y border-border py-3">
      <h2 className="field-label">Collections</h2>
      <CollectionLabels record={record} />
      <AssignCollectionsDialog records={[record]} />
    </section>
  );
}
export function AddCollectionRecordsDialog({ collectionId }: { collectionId: string }) {
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [picked, setPicked] = useState<Map<string, RecordKey>>(new Map()),
    [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const {
    data: rows = [],
    isFetching,
    error,
  } = useQuery({
    queryKey: ["collection-record-options", q],
    queryFn: () => fetchRecordOptions(q),
    enabled: open,
  });
  async function add() {
    setBusy(true);
    try {
      await applyCollections([collectionId], [...picked.values()]);
      await qc.invalidateQueries({ queryKey: ["collections"] });
      await qc.invalidateQueries({ queryKey: ["collection-records"] });
      setOpen(false);
      setPicked(new Map());
      toast.success("Records added");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="size-4" />
          Add records
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add archive records</DialogTitle>
          <DialogDescription>Letters, photographs and digital sources</DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Find archive records"
          placeholder="Record number, title or person…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {error && <p role="alert">{error.message}</p>}
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}
          {rows.map((r) => {
            const key = { kind: r.kind, id: r.ref_id };
            return (
              <label key={recordKey(key)} className="flex gap-2 border-b border-border py-2">
                <Checkbox
                  aria-label={`Select ${r.identifier}`}
                  checked={picked.has(recordKey(key))}
                  onCheckedChange={(v) =>
                    setPicked((p) => {
                      const n = new Map(p);
                      if (v) n.set(recordKey(key), key);
                      else n.delete(recordKey(key));
                      return n;
                    })
                  }
                />
                <span className="min-w-0 text-sm">
                  <strong>{r.identifier}</strong> · {r.title || "Untitled"}
                  <span className="block text-xs text-muted-foreground">
                    {r.record_type} · {r.date_text || r.sort_date || "Undated"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <Button onClick={add} disabled={!picked.size || busy}>
          {busy ? "Adding…" : `Add selected records (${picked.size})`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
