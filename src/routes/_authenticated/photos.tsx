import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, ImagePlus, Loader2, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { deliverFile } from "@/lib/download";
import {
  backfillViewCopies,
  convertExistingPhotos,
  createPhoto,
  deletePhoto,
  fetchPhotoOriginal,
  fetchPhotos,
  missingViewCount,
  pendingConversionCount,
  updatePhoto,
  viewPath,
  type Photo,
} from "@/lib/photos";


const photosOptions = queryOptions({ queryKey: ["photos"], queryFn: fetchPhotos });

export const Route = createFileRoute("/_authenticated/photos")({
  head: () => ({
    meta: [
      { title: "Photos — The Francis Files" },
      { name: "description", content: "A simple gallery of family photographs with captions and notes." },
      { property: "og:title", content: "Photos — The Francis Files" },
      { property: "og:description", content: "A simple gallery of family photographs with captions and notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(photosOptions),
  pendingComponent: () => (
    <AppShell>
      <PageHeader title="Photos" />
      <p className="p-8 text-sm text-muted-foreground">Loading photos…</p>
    </AppShell>
  ),
  errorComponent: ({ reset }) => (
    <AppShell>
      <PageHeader title="Photos" />
      <div className="space-y-3 p-8">
        <p>Photos could not be loaded.</p>
        <Button variant="outline" onClick={reset}>Try again</Button>
      </div>
    </AppShell>
  ),
  component: () => (
    <AppShell>
      <Gallery />
    </AppShell>
  ),
});

function useSigned(path: string | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    setUrl("");
    if (path)
      supabase.storage
        .from("scans")
        .createSignedUrl(path, 3600)
        .then(({ data }) => alive && setUrl(data?.signedUrl ?? ""));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

function Img({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const url = useSigned(path);
  return url ? (
    <img src={url} alt={alt} className={className} loading="lazy" />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
      {path ? "…" : "No preview"}
    </div>
  );
}

function Gallery() {
  const { data: photos } = useSuspenseQuery(photosOptions);
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);
  const [dropping, setDropping] = useState(0);
  const [converting, setConverting] = useState(false);
  const [backfilling, setBackfilling] = useState<{ done: number; total: number } | null>(null);
  const pending = useQuery({ queryKey: ["photos-pending"], queryFn: pendingConversionCount, enabled: canEdit !== false });
  const missingViews = useQuery({ queryKey: ["photos-missing-views"], queryFn: missingViewCount, enabled: canEdit !== false });

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return photos;
    return photos.filter((p) => `${p.caption ?? ""} ${p.notes ?? ""}`.toLowerCase().includes(t));
  }, [photos, q]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["photos"] });
    qc.invalidateQueries({ queryKey: ["photos-pending"] });
  };

  const bulk = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(tiff?|jpe?g|png|heic)$/i.test(f.name));
    if (!imgs.length) return;
    setDropping(imgs.length);
    let ok = 0;
    for (const f of imgs) {
      try {
        await createPhoto({ front: f });
        ok++;
      } catch (e) {
        toast.error((e as Error).message);
      }
      setDropping((n) => n - 1);
    }
    toast.success(`Added ${ok} photo${ok === 1 ? "" : "s"}`);
    refresh();
  };

  const convert = async () => {
    setConverting(true);
    try {
      const n = await convertExistingPhotos();
      toast.success(`Moved ${n} photo${n === 1 ? "" : "s"} into the gallery`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div
      onDragOver={(e) => canEdit !== false && e.preventDefault()}
      onDrop={(e) => {
        if (canEdit === false) return;
        e.preventDefault();
        bulk(Array.from(e.dataTransfer.files));
      }}
    >
      <PageHeader
        title="Photos"
        description={`${photos.length} photo${photos.length === 1 ? "" : "s"} · drag photos anywhere on this page to add them`}
        actions={
          canEdit !== false ? (
            <Button onClick={() => setAdding(true)}>
              <ImagePlus className="mr-1 h-4 w-4" /> New Photo
            </Button>
          ) : null
        }
      />
      <div className="space-y-4 px-4 py-4 sm:px-8">
        {!!pending.data && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <span>{pending.data} older photo{pending.data === 1 ? "" : "s"} (FH photo records and Unassigned Photos) can be moved here.</span>
            <Button size="sm" variant="outline" onClick={convert} disabled={converting}>
              {converting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              Move them into the gallery
            </Button>
          </div>
        )}
        {dropping > 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading {dropping}…
          </p>
        )}
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search captions and notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shown.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpen(p)}
                className="group overflow-hidden rounded-md border border-border bg-card text-left transition hover:shadow-md"
              >
                <div className="aspect-square bg-muted">
                  <Img path={viewPath(p.front_path, p.front_thumb_path)} alt={p.caption ?? "Photo"} className="h-full w-full object-cover" />
                </div>
                <div className="truncate px-2 py-1.5 text-xs">{p.caption || <span className="text-muted-foreground">Untitled</span>}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <NewPhotoDialog open={adding} onOpenChange={setAdding} onSaved={refresh} />
      {open && <PhotoViewer photo={open} canEdit={canEdit !== false} onClose={() => setOpen(null)} onChanged={refresh} />}
    </div>
  );
}

function FilePick({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file || /tiff?$/i.test(file.type) || /\.tiff?$/i.test(file.name)) return setPreview("");
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFile(e.dataTransfer.files[0] ?? null);
      }}
      onClick={() => ref.current?.click()}
      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/30 p-2 text-center text-xs text-muted-foreground hover:bg-muted/60"
    >
      <input ref={ref} type="file" accept="image/*,.tif,.tiff" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      {preview ? (
        <img src={preview} alt={label} className="h-full w-full object-contain" />
      ) : file ? (
        <span className="break-all">{file.name}</span>
      ) : (
        <>
          <UploadCloud className="h-6 w-6" />
          <span>{label}</span>
        </>
      )}
    </div>
  );
}

function NewPhotoDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const reset = () => {
    setFront(null);
    setBack(null);
    setCaption("");
    setNotes("");
  };
  const save = async () => {
    if (!front) return;
    setSaving(true);
    try {
      await createPhoto({ front, back, caption, notes });
      toast.success("Photo added");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Photo</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FilePick label="Front (required)" file={front} onFile={setFront} />
          <FilePick label="Back (optional)" file={back} onFile={setBack} />
        </div>
        <Input placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <Textarea rows={4} placeholder="Notes — date, people, writing on back, research…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button onClick={save} disabled={!front || saving}>
          {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save photo
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function PhotoViewer({ photo, canEdit, onClose, onChanged }: { photo: Photo; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [notes, setNotes] = useState(photo.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [getting, setGetting] = useState(false);
  const [fileError, setFileError] = useState("");
  const dirty = caption !== (photo.caption ?? "") || notes !== (photo.notes ?? "");
  const original = side === "front" ? photo.front_path : photo.back_path;
  const path = side === "front" ? viewPath(photo.front_path, photo.front_thumb_path) : viewPath(photo.back_path, photo.back_thumb_path);

  // The original file is fetched as soon as the photo opens (and again when
  // flipping to the back) so Download can hand it over straight from the click.
  useEffect(() => {
    let alive = true;
    setFile(null);
    setFileError("");
    if (!original) return;
    setGetting(true);
    fetchPhotoOriginal(original)
      .then((f) => alive && setFile(f))
      .catch((e) => alive && setFileError((e as Error).message || "This photo's file could not be opened."))
      .finally(() => alive && setGetting(false));
    return () => {
      alive = false;
    };
  }, [original]);


  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{photo.caption || "Photo"}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[60vh] items-center justify-center bg-muted">
          <Img path={path} alt={side} className="max-h-[60vh] w-auto object-contain" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {photo.back_path && (
            <>
              <Button size="sm" variant={side === "front" ? "default" : "outline"} onClick={() => setSide("front")}>Front</Button>
              <Button size="sm" variant={side === "back" ? "default" : "outline"} onClick={() => setSide("back")}>Back</Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!file}
            title={fileError || "Downloads the original file at full quality"}
            onClick={() => file && deliverFile(file.blob, file.name)}
          >
            {getting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            {fileError ? "Download unavailable" : getting ? "Preparing…" : "Download"}
          </Button>
          {fileError && <span className="text-xs text-muted-foreground">{fileError}</span>}

        </div>

        {canEdit ? (
          <>
            <Input placeholder="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
            <Textarea rows={5} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (!confirm("Delete this photo?")) return;
                  setBusy(true);
                  try {
                    await deletePhoto(photo);
                    onChanged();
                    onClose();
                  } catch (e) {
                    toast.error((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
              <Button
                disabled={!dirty || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await updatePhoto(photo.id, { caption, notes });
                    toast.success("Saved");
                    onChanged();
                    onClose();
                  } catch (e) {
                    toast.error((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                Save
              </Button>
            </div>
          </>
        ) : (
          photo.notes && <p className="whitespace-pre-wrap text-sm">{photo.notes}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
