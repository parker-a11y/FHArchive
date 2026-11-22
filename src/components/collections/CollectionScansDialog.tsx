import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Images } from "lucide-react";
import { toast } from "sonner";
import { deliverFile } from "@/lib/download";
import { flatScanName } from "@/lib/scan-zip-names";

type Rec = { id: string; identifier: string };
type Scan = { id: string; letter_id: string; label: string | null; original_filename: string; master_path: string; thumb?: string };

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export function CollectionScansDialog({ records }: { records: Rec[] }) {
  const [open, setOpen] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [zip, setZip] = useState<Blob | null>(null);
  const [progress, setProgress] = useState("");
  const ids = records.map((r) => r.id).join(",");

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true); setPicked(new Set()); setZip(null); setProgress("");
      const out: Scan[] = [];
      for (const part of chunk(records.map((r) => r.id), 100)) {
        const { data, error } = await supabase.from("digital_files")
          .select("id, letter_id, label, original_filename, master_path, sort_order")
          .in("letter_id", part).order("sort_order").limit(2000);
        if (error) { toast.error(error.message); break; }
        out.push(...(data ?? []));
        const fids = (data ?? []).map((d) => d.id);
        for (const fp of chunk(fids, 200)) {
          const { data: th } = await supabase.from("file_derivatives").select("file_id, storage_path")
            .in("file_id", fp).eq("kind", "thumbnail").eq("status", "complete");
          const paths = (th ?? []).filter((t) => t.storage_path);
          if (!paths.length) continue;
          const { data: signed } = await supabase.storage.from("scans").createSignedUrls(paths.map((t) => t.storage_path!), 3600);
          paths.forEach((t, i) => { const s = out.find((x) => x.id === t.file_id); if (s && signed?.[i]?.signedUrl) s.thumb = signed[i].signedUrl; });
        }
      }
      if (!cancel) { setScans(out); setLoading(false); }
    })();
    return () => { cancel = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ids]);

  const toggle = (id: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  async function download() {
    setBusy(true); setZip(null);
    const list = scans.filter((s) => picked.has(s.id));
    const { default: JSZip } = await import("jszip");
    const z = new JSZip();
    const used = new Set<string>();
    const recId = new Map(records.map((r) => [r.id, r.identifier]));
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i]!;
      setProgress(`Fetching ${i + 1} of ${list.length}…`);
      const base = s.original_filename || s.master_path.split("/").pop() || "scan.tif";
      const name = flatScanName(recId.get(s.letter_id) ?? "record", base, used);
      used.add(name);
      const { data, error } = await supabase.storage.from("scans").download(s.master_path);
      if (error || !data) { toast.error(`${base}: ${error?.message ?? "failed"}`); continue; }
      z.file(name, data); ok++;
    }
    setProgress(`Building ZIP of ${ok} file${ok === 1 ? "" : "s"}…`);
    const blob = await z.generateAsync({ type: "blob", compression: "STORE" });
    setZip(blob); setProgress(`Ready: ${ok} of ${list.length} scans`); setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Images className="size-4" /> Show scans</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Scans for {records.length} record{records.length === 1 ? "" : "s"}</DialogTitle></DialogHeader>
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background py-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox aria-label="Select all scans" checked={scans.length > 0 && picked.size === scans.length}
              onCheckedChange={(v) => setPicked(v ? new Set(scans.map((s) => s.id)) : new Set())} />
            Select all ({scans.length})
          </label>
          <Button size="sm" disabled={!picked.size || busy} onClick={download}>
            <Download className="size-4" /> Prepare ZIP of TIFF originals ({picked.size})
          </Button>
          {progress && <span className="text-sm text-muted-foreground">{progress}</span>}
          {zip && <Button size="sm" variant="secondary" onClick={() => deliverFile(zip, `collection-scans-${new Date().toISOString().slice(0, 10)}.zip`)}>
            <Download className="size-4" /> Save ZIP</Button>}
        </div>
        {loading ? <p className="py-8 text-muted-foreground">Loading scans…</p> : !scans.length ? <p className="py-8 text-muted-foreground">No scans for these records.</p> :
          records.map((r) => {
            const own = scans.filter((s) => s.letter_id === r.id);
            if (!own.length) return null;
            return (
              <section key={r.id} className="mb-4">
                <h3 className="mb-2 font-mono text-sm font-bold">{r.identifier}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {own.map((s) => (
                    <label key={s.id} className="relative block cursor-pointer rounded border border-border p-1">
                      <Checkbox className="absolute left-2 top-2 bg-background" aria-label={`Select ${r.identifier} ${s.label ?? s.original_filename}`}
                        checked={picked.has(s.id)} onCheckedChange={(v) => toggle(s.id, Boolean(v))} />
                      {s.thumb ? <img src={s.thumb} alt={s.label ?? s.original_filename} className="aspect-[3/4] w-full object-contain bg-muted" loading="lazy" />
                        : <div className="aspect-[3/4] w-full bg-muted" />}
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{s.label || s.original_filename}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
      </DialogContent>
    </Dialog>
  );
}
