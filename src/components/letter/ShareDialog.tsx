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
import { fetchDigitalFiles } from "@/lib/digital-files";
import {
  createShare,
  deleteShare,
  fetchShares,
  regenerateShare,
  setVisibility,
  shareUrl,
  updateShare,
  VISIBILITY,
  type RecordShare,
} from "@/lib/shares";
import type { Letter } from "@/lib/queries";

function copy(token: string) {
  navigator.clipboard.writeText(shareUrl(token));
  toast.success("Public link copied to clipboard");
}

export function ShareStatusBadge({ letter }: { letter: Letter & { visibility?: string } }) {
  const v = letter.visibility ?? "private";
  const label = VISIBILITY.find((x) => x.value === v)?.label ?? "Private";
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

export function ShareDialog({ letter }: { letter: Letter & { visibility?: string } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: shares = [] } = useQuery({
    queryKey: ["shares", letter.id],
    queryFn: () => fetchShares(letter.id),
    enabled: open,
  });
  const { data: files = [] } = useQuery({
    queryKey: ["digital-files", letter.id],
    queryFn: () => fetchDigitalFiles(letter.id),
    enabled: open,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["shares", letter.id] });
    await qc.invalidateQueries({ queryKey: ["letter", letter.archive_id] });
    await qc.invalidateQueries({ queryKey: ["letters"] });
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
        <Button variant="outline">
          <Share2 className="mr-1.5 size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share {letter.archive_id}</DialogTitle>
          <DialogDescription>
            Public links are unguessable, excluded from search engines, and show web copies only —
            never your archival master files. You can disable or regenerate a link at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <div className="field-label mb-1">Visibility</div>
            <select
              value={letter.visibility ?? "private"}
              onChange={(e) => run(() => setVisibility(letter.id, e.target.value), "Visibility updated")}
              className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
            >
              {VISIBILITY.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Published marks a record as intended for the future public archive; it does not expose
              it yet.
            </p>
          </section>

          <section>
            <h3 className="font-medium">Whole record</h3>
            {recordShare ? (
              <ShareRow share={recordShare} busy={busy} run={run} />
            ) : (
              <Button
                className="mt-2"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const s = await createShare({ letterId: letter.id });
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
            <h3 className="font-medium">Single item or page</h3>
            {files.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                No digital files in this record yet.
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                {files.map((f) => {
                  const s = fileShares.find((x) => x.file_id === f.id);
                  return (
                    <div key={f.id} className="rounded border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm">
                          {f.label || f.original_filename}
                          {f.seq ? ` · page ${f.seq}` : ""}
                        </span>
                        {!s && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const created = await createShare({
                                  letterId: letter.id,
                                  fileId: f.id,
                                });
                                copy(created.token);
                              })
                            }
                          >
                            <Link2 className="mr-1.5 size-3.5" />
                            Share item
                          </Button>
                        )}
                      </div>
                      {s && <ShareRow share={s} busy={busy} run={run} />}
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

function ShareRow({
  share,
  busy,
  run,
}: {
  share: RecordShare;
  busy: boolean;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const [note, setNote] = useState(share.public_note ?? "");

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-border bg-muted px-2 py-1.5 text-xs">
          {shareUrl(share.token)}
        </code>
        <Button size="sm" variant="outline" onClick={() => copy(share.token)} disabled={!share.enabled}>
          <Copy className="mr-1.5 size-3.5" />
          Copy link
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={shareUrl(share.token)} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 size-3.5" />
            Open
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(() => regenerateShare(share.id), "New link created — old one no longer works")}
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
              () => updateShare(share.id, { enabled: !share.enabled }),
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
          onClick={() => run(() => deleteShare(share.id), "Share deleted")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={share.include_transcription}
            onChange={(e) => run(() => updateShare(share.id, { include_transcription: e.target.checked }))}
          />
          Include transcription
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={share.include_notes}
            onChange={(e) => run(() => updateShare(share.id, { include_notes: e.target.checked }))}
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
        onBlur={() => note !== (share.public_note ?? "") && run(() => updateShare(share.id, { public_note: note || null }))}
      />
    </div>
  );
}
