import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Globe, Link2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RelatedRecordsPicker } from "@/components/RelatedRecordsPicker";
import {
  addRecordLink,
  fetchRelatedRecords,
  recordThumbnailUrl,
  removeRecordLink,
  typeLabelFor,
  updateRecordLinkNote,
  type ArchiveRecordRef,
  type RecordKind,
  type RecordLink,
} from "@/lib/record-links";

function RecordThumb({ kind, id }: { kind: RecordKind; id: string }) {
  const { data: url } = useQuery({
    queryKey: ["recordThumb", kind, id],
    queryFn: () => recordThumbnailUrl(kind, id),
    staleTime: 10 * 60_000,
  });
  if (!url)
    return (
      <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {kind === "letter" ? <FileText className="size-5" /> : <Globe className="size-5" />}
      </div>
    );
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="size-16 shrink-0 rounded-lg border border-border object-cover"
    />
  );
}

export function RelatedRecordLine({ record }: { record: ArchiveRecordRef }) {
  return (
    <>
      <div className="text-sm">
        <span className="archive-id">{record.ref}</span>
        {record.title ? <span> — {record.title}</span> : null}
        {record.date_text ? (
          <span className="text-muted-foreground"> · {record.date_text}</span>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground">
        {record.collection}
        {record.type_label ? ` · ${typeLabelFor(record.kind, record.type_label)}` : ""}
      </div>
    </>
  );
}

function recordLinkTo(record: ArchiveRecordRef) {
  return record.kind === "letter"
    ? ({ to: "/letters/$archiveId", params: { archiveId: record.ref } } as const)
    : ({ to: "/sources/$dsId", params: { dsId: record.ref } } as const);
}

/**
 * Universal Related Records section for any archive record page.
 * Relationships are historical/intellectual only — they never change
 * container, enclosure, provenance or storage information.
 */
export function RelatedRecordsPanel({
  kind,
  id,
  readOnly = false,
}: {
  kind: RecordKind;
  id: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const qk = ["relatedRecords", kind, id];
  const { data: links = [] } = useQuery({ queryKey: qk, queryFn: () => fetchRelatedRecords(kind, id) });
  const [pending, setPending] = useState<ArchiveRecordRef | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");

  async function connect() {
    if (!pending) return;
    setBusy(true);
    try {
      await addRecordLink({ kind, id }, { kind: pending.kind, id: pending.id }, note);
      toast.success(`Connected ${pending.ref}`);
      setPending(null);
      setNote("");
      qc.invalidateQueries({ queryKey: qk });
      qc.invalidateQueries({ queryKey: ["relatedRecords"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect those records");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(link: RecordLink) {
    try {
      await updateRecordLinkNote(link.id, editNote);
      setEditing(null);
      qc.invalidateQueries({ queryKey: qk });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the note");
    }
  }

  async function unlink(link: RecordLink) {
    try {
      await removeRecordLink(link.id);
      qc.invalidateQueries({ queryKey: qk });
      qc.invalidateQueries({ queryKey: ["relatedRecords"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the connection");
    }
  }

  return (
    <div className="max-w-3xl">
      <h3 className="field-label mb-1">Related records ({links.length})</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Historical and intellectual connections across the whole archive. Connections work both
        ways automatically and never change provenance, container or storage details.
      </p>

      <div className="space-y-2">
        {links.map((l) => (
          <div key={l.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            <RecordThumb kind={l.other.kind} id={l.other.id} />
            <div className="min-w-0 flex-1">
              <Link {...recordLinkTo(l.other)} className="block hover:underline">
                <RelatedRecordLine record={l.other} />
              </Link>
              {editing === l.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={2}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Why are these records connected?"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveNote(l)}>
                      Save note
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                l.note && <p className="mt-1.5 text-sm text-muted-foreground">{l.note}</p>
              )}
            </div>
            {!readOnly && editing !== l.id && (
              <div className="flex shrink-0 items-start gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit relationship note"
                  onClick={() => {
                    setEditing(l.id);
                    setEditNote(l.note ?? "");
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove connection to ${l.other.ref}`}
                  onClick={() => unlink(l)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {!links.length && (
          <p className="text-sm text-muted-foreground">No related records yet.</p>
        )}
      </div>

      {!readOnly && (
        <div className="mt-5 rounded-xl border border-dashed border-border p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Link2 className="size-4" /> Connect another record
          </div>
          {pending ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-muted/40 p-2">
                <RelatedRecordLine record={pending} />
              </div>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note — why these records are connected"
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={connect}>
                  {busy ? "Connecting…" : "Connect records"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <RelatedRecordsPicker
              exclude={[{ kind, id }, ...links.map((l) => ({ kind: l.other.kind, id: l.other.id }))]}
              onPick={setPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

export type PendingRelation = { record: ArchiveRecordRef; note: string };

/**
 * Related Records field for intake forms, where the new record does not exist
 * yet. Selections are held locally and written after the record is created.
 */
export function RelatedRecordsField({
  value,
  onChange,
}: {
  value: PendingRelation[];
  onChange: (next: PendingRelation[]) => void;
}) {
  return (
    <div className="space-y-2">
      {value.map((r, i) => (
        <div
          key={`${r.record.kind}:${r.record.id}`}
          className="flex gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="min-w-0 flex-1">
            <RelatedRecordLine record={r.record} />
            <Textarea
              className="mt-2"
              rows={2}
              value={r.note}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...r, note: e.target.value };
                onChange(next);
              }}
              placeholder="Optional note — why these records are connected"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${r.record.ref}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <RelatedRecordsPicker
        exclude={value.map((r) => ({ kind: r.record.kind, id: r.record.id }))}
        onPick={(record) => onChange([...value, { record, note: "" }])}
      />
    </div>
  );
}
