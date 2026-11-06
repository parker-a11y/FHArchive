import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhId } from "@/lib/photo-archive";
import { backfillViewCopies, convertExistingPhotos, missingViewCount, originalName, pendingConversionCount } from "@/lib/photos";
import { numberingState, runPhNumbering } from "@/lib/photo-catalog";
import { usePhotoData } from "@/components/photos/usePhotoData";

/** Preview of the PH numbers about to be assigned, applied only when an administrator approves. */
export function PhNumbering() {
  const d = usePhotoData();
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ["photo-counter"], queryFn: numberingState });
  const pending = useQuery({ queryKey: ["photos-pending"], queryFn: pendingConversionCount });
  const missing = useQuery({ queryKey: ["photos-missing-views"], queryFn: missingViewCount });
  const [busy, setBusy] = useState<string | null>(null);

  const preview = useMemo(() => {
    let seq = Math.max(state.data?.last_seq ?? 0, ...d.photos.map((p) => p.ph_seq ?? 0));
    return d.photos.filter((p) => p.ph_seq == null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map((p) => ({ p, ph: formatPhId(++seq) }));
  }, [d.photos, state.data]);

  const issues = useMemo(() => {
    const out: string[] = [];
    const byPath = new Map<string, number>();
    for (const p of d.photos) byPath.set(p.front_path, (byPath.get(p.front_path) ?? 0) + 1);
    for (const [path, n] of byPath) if (n > 1) out.push(`${n} photographs share the same file ${originalName(path)} — possible duplicate.`);
    const legacy = new Map<string, number>();
    for (const p of d.photos) if (p.legacy_archive_id) legacy.set(p.legacy_archive_id, (legacy.get(p.legacy_archive_id) ?? 0) + 1);
    for (const [id, n] of legacy) if (n > 1) out.push(`${id} is linked to ${n} photographs.`);
    return out;
  }, [d.photos]);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    try { toast.success(await fn()); } catch (e) { toast.error((e as Error).message); }
    finally {
      setBusy(null);
      d.refresh();
      for (const k of ["photo-counter", "photos-pending", "photos-missing-views"]) qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const numbered = d.photos.filter((p) => p.ph_seq != null).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="space-y-2">
        <h2 className="font-display text-2xl">Permanent PH numbers</h2>
        <p className="text-sm text-muted-foreground">
          {numbered} of {d.photos.length} photographs numbered.
          {state.data?.numbering_enabled ? " New uploads are numbered automatically." : " Automatic numbering starts once you approve the first assignment below."}
        </p>
        {issues.length > 0 && (
          <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="flex items-center gap-1 font-medium"><AlertTriangle className="size-4" />Please review before approving</p>
            {issues.map((i) => <p key={i}>{i}</p>)}
          </div>
        )}
        {preview.length === 0 ? (
          <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-primary" />Every photograph has its PH number.</p>
        ) : (
          <>
            <div className="max-h-[50vh] overflow-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground"><tr><th className="px-2 py-1.5">New PH</th><th className="px-2 py-1.5">Former FH</th><th className="px-2 py-1.5">Subtitle</th><th className="px-2 py-1.5">File</th><th className="px-2 py-1.5">Uploaded</th></tr></thead>
                <tbody>{preview.map(({ p, ph }) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="px-2 py-1 font-mono text-xs">{ph}</td>
                    <td className="px-2 py-1 font-mono text-xs">{p.legacy_archive_id ?? "—"}</td>
                    <td className="px-2 py-1">{p.caption ?? "—"}</td>
                    <td className="max-w-[16rem] truncate px-2 py-1 text-xs text-muted-foreground">{originalName(p.front_path)}{p.back_path ? " + back" : ""}</td>
                    <td className="px-2 py-1 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <Button disabled={!!busy} onClick={() => {
              if (!confirm(`Assign permanent PH numbers to ${preview.length} photographs? Numbers can never be changed or reused.`)) return;
              void run("number", async () => `Numbered ${await runPhNumbering()} photographs`);
            }}>
              {busy === "number" && <Loader2 className="mr-1 size-4 animate-spin" />}Approve and assign {preview.length} PH numbers
            </Button>
          </>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h2 className="font-display text-xl">Maintenance</h2>
        {!!pending.data && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <span>{pending.data} older FH photo record(s) can still be moved into the Photo Archive. Their FH numbers stay as legacy references.</span>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void run("convert", async () => `Moved ${await convertExistingPhotos()} photographs`)}>
              {busy === "convert" ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}Move them
            </Button>
          </div>
        )}
        {!!missing.data && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <span>{missing.data} photograph(s) only have a small preview.</span>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void run("views", async () => { const r = await backfillViewCopies(); return `Made ${r.done} viewing copies${r.failed.length ? `, ${r.failed.length} failed` : ""}`; })}>
              {busy === "views" ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}Make large viewing copies
            </Button>
          </div>
        )}
        {!pending.data && !missing.data && <p className="text-sm text-muted-foreground">Nothing needs attention. All former FH photographs are already in the Photo Archive.</p>}
      </section>
    </div>
  );
}
