import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, RefreshCw, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fetchDsFiles, type DigitalSource } from "@/lib/sources";
import {
  createSourceShare,
  deleteSourceShare,
  DS_VISIBILITY,
  fetchSourceShares,
  regenerateSourceShare,
  setSourceVisibility,
  sourceShareUrl,
  updateSourceShare,
  type SourceShare,
} from "@/lib/source-shares";

function copy(token: string) {
  navigator.clipboard.writeText(sourceShareUrl(token));
  toast.success("Public link copied to clipboard");
}

export function SourceShareStatusBadge({ visibility }: { visibility?: string }) {
  const v = visibility ?? "private";
  const label = DS_VISIBILITY.find((x) => x.value === v)?.label ?? "Private";
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-xs ${
        v === "private"
          ? "border-border bg-secondary text-muted-foreground"
          : "border-primary/40 bg-primary/10 text-primary"
      }`}
    >
      {label}
    </span>
  );
}

export function ShareSourceDialog({
  source,
}: {
  source: DigitalSource & { visibility?: string };
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: shares = [] } = useQuery({
    queryKey: ["source-shares", source.id],
    queryFn: () => fetchSourceShares(source.id),
    enabled: open,
  });
  const { data: files = [] } = useQuery({
    queryKey: ["ds-files", source.id],
    queryFn: () => fetchDsFiles(source.id),
    enabled: open,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["source-shares", source.id] });
    await qc.invalidateQueries({ queryKey: ["source", source.ds_id] });
    await qc.invalidateQueries({ queryKey: ["sources"] });
  };

  const run = async (fn: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (message) toast.success(message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const recordShare = shares.find((s) => s.scope === "record");
  const fileShares = shares.filter((s) => s.scope === "file");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Share2 className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share {source.ds_id}</DialogTitle>
          <DialogDescription>
            Public links are unguessable, excluded from search engines, and show only the
            preservation copies you have uploaded for this source. You can disable or regenerate a
            link at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <div className="field-label mb-1">Visibility</div>
            <select
              value={source.visibility ?? "private"}
              onChange={(e) =>
                run(() => setSourceVisibility(source.id, e.target.value), "Visibility updated")
              }
              className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
            >
              {DS_VISIBILITY.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Published marks a source as intended for the future public archive; it does not expose
              it yet.
            </p>
          </section>

          <section>
            <h3 className="font-medium">Whole source</h3>
            {recordShare ? (
              <SourceShareRow share={recordShare} busy={busy} run={run} />
            ) : (
              <Button
                className="mt-2"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const s = await createSourceShare({ sourceId: source.id });
                    copy(s.token);
                  })
                }
              >
                <Link2 className="mr-1.5 size-4" />
                Create public link
              </Button>
            )}
          </section>

          <section>
            <h3 className="font-medium">Single file</h3>
            {files.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                No preservation copies in this source yet.
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                {files.map((f) => {
                  const s = fileShares.find((x) => x.file_id === f.id);
                  return (
                    <div key={f.id} className="rounded border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm">
                          {f.file_label || f.original_filename} · {f.file_type}
                        </span>
                        {!s && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const created = await createSourceShare({
                                  sourceId: source.id,
                                  fileId: f.id,
                                });
                                copy(created.token);
                              })
                            }
                          >
                            <Link2 className="mr-1.5 size-3.5" />
                            Share file
                          </Button>
                        )}
                      </div>
                      {s && <SourceShareRow share={s} busy={busy} run={run} />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SourceShareRow({
  share,
  busy,
  run,
}: {
  share: SourceShare;
  busy: boolean;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const [note, setNote] = useState(share.public_note ?? "");

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-border bg-muted px-2 py-1.5 text-xs">
          {sourceShareUrl(share.token)}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => copy(share.token)}
          disabled={!share.enabled}
        >
          <Copy className="mr-1.5 size-3.5" />
          Copy link
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={sourceShareUrl(share.token)} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 size-3.5" />
            Open
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(() => regenerateSourceShare(share.id), "New link created — old one no longer works")
          }
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          Regenerate
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(
              () => updateSourceShare(share.id, { enabled: !share.enabled }),
              share.enabled ? "Link disabled" : "Link enabled",
            )
          }
        >
          {share.enabled ? "Disable" : "Enable"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={busy}
          onClick={() => run(() => deleteSourceShare(share.id), "Share deleted")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={share.include_transcript}
            onChange={(e) =>
              run(() => updateSourceShare(share.id, { include_transcript: e.target.checked }))
            }
          />
          Include transcript
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={share.include_notes}
            onChange={(e) =>
              run(() => updateSourceShare(share.id, { include_notes: e.target.checked }))
            }
          />
          Include notes
        </label>
        <span className={share.enabled ? "text-primary" : "text-muted-foreground"}>
          {share.enabled ? "Active" : "Disabled"} · {share.view_count} views
        </span>
      </div>

      <Textarea
        value={note}
        placeholder="Optional note shown to visitors on the public page"
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() =>
          note !== (share.public_note ?? "") &&
          run(() => updateSourceShare(share.id, { public_note: note || null }))
        }
      />
    </div>
  );
}
