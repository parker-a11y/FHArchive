import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MediaLightbox, type LightboxItem } from "@/components/ui/media-lightbox";
import { supabase } from "@/integrations/supabase/client";
import {
  DS_FILE_TYPES,
  fetchDsFiles,
  formatFileSize,
  inferFileType,
  type DigitalSource,
  type DsFile,
} from "@/lib/sources";

const BUCKET = "ds-files";

function useSignedUrl(path: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from(BUCKET)
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

function FileCard({
  file,
  onSave,
  onDelete,
  onOpen,
}: {
  file: DsFile;
  onSave: (patch: Partial<DsFile>) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const url = file.signedUrl || useSignedUrl(file.storage_path);
  const [label, setLabel] = useState(file.file_label);
  const [notes, setNotes] = useState(file.notes ?? "");
  const dirty = label !== file.file_label || notes !== (file.notes ?? "");
  const isViewable = ["image", "audio", "video"].includes(file.file_type);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 overflow-hidden rounded-lg bg-muted">
        {file.file_type === "image" && url && (
          <button
            onClick={onOpen}
            className="block h-56 w-full cursor-zoom-in"
            aria-label={`Open ${file.file_label || "image"} fullscreen`}
          >
            <img src={url} alt={file.file_label || "Preservation copy"} className="h-full w-full object-contain" />
          </button>
        )}
        {file.file_type === "audio" && url && (
          <div className="flex h-56 flex-col items-center justify-center px-4">
            <audio controls src={url} className="w-full" />
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={onOpen}>
              Open audio player
            </Button>
          </div>
        )}
        {file.file_type === "video" && url && (
          <button onClick={onOpen} className="block h-56 w-full cursor-zoom-in">
            <video src={url} className="h-full w-full object-contain" />
          </button>
        )}
        {!isViewable && (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <FileText className="size-8" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
        <div className="flex items-center gap-2">
          <Select value={file.file_type} onValueChange={(v) => onSave({ file_type: v })}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DS_FILE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
          <div className="ml-auto flex items-center gap-1">
            {url && (
              <Button variant="ghost" size="icon" asChild>
                <a href={url} download={file.original_filename ?? undefined} target="_blank" rel="noreferrer">
                  <Download className="size-4" />
                </a>
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The stored copy of {file.original_filename ?? file.file_label} is permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {dirty && (
          <Button size="sm" className="w-full" onClick={() => onSave({ file_label: label, notes: notes || null })}>
            Save details
          </Button>
        )}
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{file.original_filename}</p>
    </div>
  );
}

export function DsFilesPanel({ source }: { source: DigitalSource }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const { data: files = [] } = useQuery({
    queryKey: ["ds-files", source.id],
    queryFn: () => fetchDsFiles(source.id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ds-files", source.id] });
    qc.invalidateQueries({ queryKey: ["ds-file-counts"] });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DsFile> }) => {
      const { error } = await supabase.from("ds_files").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function remove(file: DsFile) {
    await supabase.storage.from(BUCKET).remove([file.storage_path]);
    const { error } = await supabase.from("ds_files").delete().eq("id", file.id);
    if (error) return toast.error(error.message);
    toast.success("File deleted");
    invalidate();
  }

  async function upload(list: FileList | File[]) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error("You need to be signed in to upload files.");
      return;
    }

    setUploading(true);
    let index = files.length + 1;
    let ok = 0;
    let failed = 0;
    let lastError = "";

    for (const file of Array.from(list)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      // First folder MUST be the user id — storage access rules check it.
      const path = `${uid}/${source.ds_id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) {
        failed++;
        lastError = upErr.message;
        continue;
      }
      const { error } = await supabase.from("ds_files").insert({
        source_id: source.id,
        storage_path: path,
        original_filename: file.name,
        file_label: file.name.replace(/\.[^.]+$/, ""),
        file_type: inferFileType(file),
        mime_type: file.type || null,
        file_size: file.size,
        sort_order: index,
      });
      if (error) {
        failed++;
        lastError = error.message;
        // Don't leave an orphaned object behind.
        await supabase.storage.from(BUCKET).remove([path]);
        continue;
      }
      ok++;
      index++;
    }

    setUploading(false);
    invalidate();

    if (ok && failed) {
      toast.warning(`${ok} uploaded, ${failed} failed: ${lastError}`);
    } else if (ok) {
      toast.success(ok === 1 ? "Preservation copy uploaded" : `${ok} preservation copies uploaded`);
    } else if (failed) {
      toast.error(`Upload failed: ${lastError}`);
    }
  }

  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      files
        .filter((f) => f.signedUrl && ["image", "audio", "video"].includes(f.file_type))
        .map((f) => ({
          id: f.id,
          url: f.signedUrl!,
          type: f.file_type as "image" | "audio" | "video",
          title: f.file_label,
          subtitle: source.ds_id,
          filename: f.original_filename,
        })),
    [files, source.ds_id],
  );

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
        className="rounded-2xl border-2 border-dashed border-border bg-muted/40 p-8 text-center"
      >
        <Upload className="mx-auto mb-2 size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag files here to keep a local copy of this source — images, audio, video, or PDFs.
        </p>
        <label className="mt-3 inline-block">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
          <span className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm">
            Choose files
          </span>
        </label>
        {uploading && <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>}
      </div>

      {source.rights_notes && (
        <p className="rounded-lg bg-tone-amber-soft px-4 py-2 text-xs text-tone-amber">
          Rights note: {source.rights_notes}
        </p>
      )}

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No preservation copies yet. Download the file from the source URL in your browser, then upload it here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {files.map((f, i) => (
            <FileCard
              key={f.id}
              file={f}
              onSave={(patch) => saveMutation.mutate({ id: f.id, patch })}
              onDelete={() => remove(f)}
              onOpen={() => {
                setViewerIndex(lightboxItems.findIndex((item) => item.id === f.id));
                setViewerOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <MediaLightbox
        items={lightboxItems}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
