import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, UploadCloud, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPhoto } from "@/lib/photos";
import { createBatch, type PhotoBatch } from "@/lib/photo-catalog";
import { galleryOptions } from "@/routes/_authenticated/photos";

import { supabase } from "@/integrations/supabase/client";

type Item = { key: string; file: File; status: "waiting" | "uploading" | "done" | "failed"; error?: string; phId?: string; photoId?: string; thumbUrl?: string };
const isImage = (f: File) => f.type.startsWith("image/") || /\.(tiff?|jpe?g|png)$/i.test(f.name);
const PARALLEL = 2;

export function BatchUpload() {
  const qc = useQueryClient();
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const batch = useRef<PhotoBatch | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const add = (files: File[]) => {
    const imgs = files.filter(isImage);
    if (imgs.length < files.length) toast.warning(`${files.length - imgs.length} non-image file(s) skipped`);
    setItems((cur) => {
      const seen = new Set(cur.map((i) => i.key));
      return [...cur, ...imgs.map((file) => ({ key: `${file.name}:${file.size}:${file.lastModified}`, file, status: "waiting" as const })).filter((i) => !seen.has(i.key))];
    });
  };
  const set = (key: string, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  /** Uploads only files not yet done, so a retry never duplicates a finished photograph. */
  const run = async (only?: Item[]) => {
    const queue = (only ?? items).filter((i) => i.status === "waiting" || i.status === "failed");
    if (!queue.length) return;
    setRunning(true);
    try {
      if (!batch.current) batch.current = await createBatch(name);
      const b = batch.current;
      let next = 0;
      const worker = async () => {
        while (next < queue.length) {
          const it = queue[next++];
          set(it.key, { status: "uploading", error: undefined });
          try {
            const res = await createPhoto({ front: it.file, batchId: b.id });
            let thumbUrl: string | undefined;
            if (res.thumbPath) {
              const { data: s } = await supabase.storage.from("scans").createSignedUrl(res.thumbPath, 3600);
              thumbUrl = s?.signedUrl;
            }
            set(it.key, { status: "done", phId: res.phId ?? undefined, photoId: res.id, thumbUrl });
          }
          catch (e) { set(it.key, { status: "failed", error: (e as Error).message }); }
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));
    } catch (e) { toast.error((e as Error).message); }
    finally {
      setRunning(false);
      qc.invalidateQueries({ queryKey: galleryOptions.queryKey });
      qc.invalidateQueries({ queryKey: ["photo-batches"] });
    }
  };

  const count = (s: Item["status"]) => items.filter((i) => i.status === s).length;
  const done = count("done"), failed = count("failed"), up = count("uploading");
  const reset = () => { setItems([]); setName(""); batch.current = null; };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files)); }}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition ${over ? "border-primary bg-accent/40" : "border-border"}`}>
        <UploadCloud className="size-10 text-muted-foreground" />
        <p className="font-display text-xl">Drop TIFF scans here</p>
        <p className="text-sm text-muted-foreground">Any number at once. Each photograph gets its own PH number; no details are needed now.</p>
        <input ref={input} type="file" multiple accept="image/*,.tif,.tiff" className="hidden" onChange={(e) => { add(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <Button variant="outline" onClick={() => input.current?.click()}>Choose files</Button>
      </div>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-sm" value={name} disabled={!!batch.current} onChange={(e) => setName(e.target.value)} placeholder="Optional batch name, e.g. Harley Family Photographs — November 2026" aria-label="Batch name" />
            <Button disabled={running || done === items.length} onClick={() => void run()}>
              {running ? <Loader2 className="mr-1 size-4 animate-spin" /> : <UploadCloud className="mr-1 size-4" />}
              {batch.current ? "Continue upload" : `Upload ${items.length} photograph${items.length === 1 ? "" : "s"}`}
            </Button>
            {failed > 0 && !running && <Button variant="outline" onClick={() => void run(items.filter((i) => i.status === "failed"))}><RotateCcw className="mr-1 size-4" />Retry {failed} failed</Button>}
            {!running && <Button variant="ghost" onClick={reset}>{done === items.length ? "Start a new batch" : "Clear"}</Button>}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            {[["Total", items.length], ["Completed", done], ["In progress", up], ["Failed", failed]].map(([l, n]) => (
              <div key={l} className="rounded-md border border-border p-2"><div className="text-xl font-semibold">{n}</div><div className="text-xs text-muted-foreground">{l}</div></div>
            ))}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(done / items.length) * 100}%` }} /></div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
            {items.map((i) => (
              <li key={i.key} className="flex items-center gap-2 px-3 py-1.5">
                {i.status === "done" ? <CheckCircle2 className="size-4 text-primary" /> : i.status === "failed" ? <XCircle className="size-4 text-destructive" /> : i.status === "uploading" ? <Loader2 className="size-4 animate-spin" /> : <span className="size-4" />}
                {i.thumbUrl ? (
                  <img src={i.thumbUrl} alt={i.phId ?? i.file.name} className="size-10 shrink-0 rounded-sm border border-border object-cover" />
                ) : i.status === "done" ? (
                  <span className="size-10 shrink-0 rounded-sm border border-border bg-muted" />
                ) : null}
                {i.phId && <span className="archive-id shrink-0 font-semibold">{i.phId}</span>}
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{i.file.name}</span>
                {i.error && <span className="truncate text-xs text-destructive" title={i.error}>{i.error}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
