import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaLightbox, type LightboxItem } from "@/components/ui/media-lightbox";
import { supabase } from "@/integrations/supabase/client";
import {
  CONTAINER_BUCKET,
  fetchContainerFiles,
  formatFileSize,
  type ContainerFile,
  type SourceContainer,
} from "@/lib/containers";

function useSignedUrl(path: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from(CONTAINER_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? "");
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

function PhotoCard({
  file,
  onOpen,
  onSave,
  onDelete,
  onDragStart,
  onDrop,
}: {
  file: ContainerFile;
  onOpen: (url: string) => void;
  onSave: (patch: Partial<ContainerFile>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const url = useSignedUrl(file.storage_path);
  const [label, setLabel] = useState(file.file_label);
  const isImage = (file.mime_type ?? "").startsWith("image/");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className="cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm active:cursor-grabbing"
    >
      <div className="mb-2 overflow-hidden rounded-lg bg-muted">
        {isImage && url ? (
          <button
            onClick={() => onOpen(url)}
            className="block h-48 w-full cursor-zoom-in"
            aria-label={`Open ${file.file_label || "container photograph"} fullscreen`}
          >
            <img
              src={url}
              alt={file.file_label || "Source container documentation photograph"}
              className="h-full w-full object-contain"
            />
          </button>
        ) : (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Camera className="size-8" />
          </div>
        )}
      </div>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== file.file_label && onSave({ file_label: label })}
        placeholder="Label (e.g. lid inscription)"
        className="h-8 text-xs"
      />
      <div className="mt-2 flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
        <div className="ml-auto flex items-center gap-1">
          {url && (
            <Button variant="ghost" size="icon" asChild>
              <a href={url} download={file.original_filename ?? undefined} target="_blank" rel="noreferrer">
                <Download className="size-4" />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ContainerPhotosPanel({ container }: { container: SourceContainer }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxItem[] | null>(null);
  const qk = ["container-files", container.id];

  const { data: files = [] } = useQuery({
    queryKey: qk,
    queryFn: () => fetchContainerFiles(container.id),
  });

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setBusy(false);
      return toast.error("Not signed in");
    }
    let n = files.length;
    for (const file of Array.from(list)) {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${container.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from(CONTAINER_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      const { error } = await supabase.from("container_files").insert({
        container_id: container.id,
        storage_path: path,
        original_filename: file.name,
        file_label: "",
        mime_type: file.type || null,
        file_size: file.size,
        sort_order: ++n,
      } as never);
      if (error) toast.error(`${file.name}: ${error.message}`);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    qc.invalidateQueries({ queryKey: qk });
    toast.success("Documentation photographs uploaded");
  }

  async function remove(file: ContainerFile) {
    await supabase.storage.from(CONTAINER_BUCKET).remove([file.storage_path]);
    const { error } = await supabase.from("container_files").delete().eq("id", file.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: qk });
  }

  async function save(file: ContainerFile, patch: Partial<ContainerFile>) {
    const { error } = await supabase
      .from("container_files")
      .update(patch as never)
      .eq("id", file.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: qk });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="field-label">Documentation photographs ({files.length})</h3>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <Button size="sm" className="gap-2" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" /> {busy ? "Uploading…" : "Add photographs"}
        </Button>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Photographs of the container as found — lids, labels, inscriptions, contents in place. These are
        collection documentation and are not assigned FH numbers.
      </p>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photographs yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((f) => (
            <PhotoCard
              key={f.id}
              file={f}
              onOpen={(url) =>
                setLightbox([
                  {
                    id: f.id,
                    url,
                    type: "image",
                    title: f.file_label || f.original_filename || "Container photograph",
                    filename: f.original_filename,
                  },
                ])
              }
              onSave={(patch) => save(f, patch)}
              onDelete={() => remove(f)}
            />
          ))}
        </div>
      )}
      <MediaLightbox
        items={lightbox ?? []}
        open={!!lightbox}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
