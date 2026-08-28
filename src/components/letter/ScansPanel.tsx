import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RotateCw, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MediaLightbox, type LightboxItem } from "@/components/ui/media-lightbox";
import { IMAGE_TYPES, scanFileLabel } from "@/lib/archive";
import type { Letter } from "@/lib/queries";

type Scan = {
  id: string;
  letter_id: string;
  item_id: string | null;
  storage_path: string;
  file_label: string;
  image_type: string;
  sort_order: number;
  rotation: number;
  original_filename: string | null;
};

function ScanThumb({
  scan,
  onOpen,
  onDragStart,
  onDrop,
  onRotate,
  onDelete,
  onType,
}: {
  scan: Scan;
  onOpen: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onType: (v: string) => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    supabase.storage
      .from("scans")
      .createSignedUrl(scan.storage_path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? ""));
  }, [scan.storage_path]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="w-44 shrink-0 rounded border border-border bg-card p-2"
    >
      <button
        onClick={() => url && onOpen()}
        className="block h-40 w-full overflow-hidden rounded bg-muted"
      >
        {url && (
          <img
            src={url}
            alt={scan.file_label}
            style={{ transform: `rotate(${scan.rotation}deg)` }}
            className="h-full w-full object-contain transition-transform"
          />
        )}
      </button>
      <div className="archive-id mt-1.5 truncate text-xs">{scan.file_label}</div>
      <select
        value={scan.image_type}
        onChange={(e) => onType(e.target.value)}
        className="mt-1 h-7 w-full rounded border border-input bg-background px-1 text-xs"
      >
        {IMAGE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="mt-1 flex justify-between">
        <Button size="icon" variant="ghost" className="size-7" onClick={onRotate}>
          <RotateCw className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ScansPanel({
  letter,
  itemId = null,
  compact = false,
  emptyLabel = "No scans attached to this record yet.",
}: {
  letter: Letter;
  itemId?: string | null;
  compact?: boolean;
  emptyLabel?: string;
}) {
  const qc = useQueryClient();
  const [viewer, setViewer] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: scans = [] } = useQuery({
    queryKey: ["scans", letter.id, itemId],
    queryFn: async () => {
      let q = supabase.from("letter_scans").select("*").eq("letter_id", letter.id);
      q = itemId ? q.eq("item_id", itemId) : q.is("item_id", null);
      const { data, error } = await q.order("sort_order");
      if (error) throw error;
      return (data ?? []) as Scan[];
    },
  });

  async function syncCount() {
    const { count } = await supabase
      .from("letter_scans")
      .select("id", { count: "exact", head: true })
      .eq("letter_id", letter.id);
    const n = count ?? 0;
    await supabase
      .from("letters")
      .update({ image_count: n, scan_status: n > 0 ? "scanned" : "not_scanned" })
      .eq("id", letter.id);
    qc.invalidateQueries({ queryKey: ["letters"] });
    qc.invalidateQueries({ queryKey: ["letter", letter.archive_id] });
  }

  async function upload(files: FileList | File[]) {
    setUploading(true);
    let index = scans.length + 1;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const label = scanFileLabel(letter.archive_id, "page_front", index);
      const path = `${letter.archive_id}/${label}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("scans").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (upErr) {
        toast.error(upErr.message);
        continue;
      }
      const { error } = await supabase.from("letter_scans").insert({
        letter_id: letter.id,
        item_id: itemId,
        storage_path: path,
        file_label: label,
        image_type: "page_front",
        sort_order: index,
        original_filename: file.name,
      });
      if (error) toast.error(error.message);
      index++;
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["scans", letter.id, itemId] });
    await syncCount();
    toast.success("Scans uploaded — originals are stored unmodified");
  }

  async function reorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const list = [...scans];
    const from = list.findIndex((s) => s.id === dragId);
    const to = list.findIndex((s) => s.id === targetId);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setDragId(null);
    await Promise.all(
      list.map((s, i) => supabase.from("letter_scans").update({ sort_order: i + 1 }).eq("id", s.id)),
    );
    qc.invalidateQueries({ queryKey: ["scans", letter.id, itemId] });
  }

  async function updateScan(id: string, patch: Partial<Scan>) {
    await supabase.from("letter_scans").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["scans", letter.id, itemId] });
  }

  async function remove(scan: Scan) {
    if (!confirm(`Remove ${scan.file_label}? The original file is deleted from storage.`)) return;
    await supabase.storage.from("scans").remove([scan.storage_path]);
    await supabase.from("letter_scans").delete().eq("id", scan.id);
    qc.invalidateQueries({ queryKey: ["scans", letter.id, itemId] });
    await syncCount();
  }

  return (
    <section>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
        className={`mb-4 rounded border border-dashed border-border bg-muted/40 text-center ${
          compact ? "px-3 py-3" : "px-6 py-6"
        }`}
      >
        <p className="text-sm text-muted-foreground">
          Drag scans here, or{" "}
          <label className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline">
            choose files
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files && upload(e.target.files)}
            />
          </label>
        </p>
        {!compact && (
          <p className="mt-1 text-xs text-muted-foreground">
            <Upload className="mr-1 inline size-3" />
            Files are named from the archive ID, e.g. {letter.archive_id}_001. Originals are never
            altered — rotation is display-only.
          </p>
        )}
        {uploading && <p className="mt-2 text-xs">Uploading…</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        {scans.map((s) => (
          <ScanThumb
            key={s.id}
            scan={s}
            onOpen={setViewer}
            onDragStart={() => setDragId(s.id)}
            onDrop={() => reorder(s.id)}
            onRotate={() => updateScan(s.id, { rotation: (s.rotation + 90) % 360 })}
            onDelete={() => remove(s)}
            onType={(v) =>
              updateScan(s.id, {
                image_type: v,
                file_label: scanFileLabel(letter.archive_id, v, s.sort_order),
              })
            }
          />
        ))}
        {scans.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}
      </div>

      <Dialog open={!!viewer} onOpenChange={() => setViewer(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl">
          {viewer && <img src={viewer} alt="Scan" className="max-h-[85vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
