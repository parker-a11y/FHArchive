/**
 * Chooses an image for a custom book page: an FH record's scans, a Photo
 * Gallery photo, or a new upload kept in the book's own storage area.
 * Archive and gallery images are referenced, never copied or changed.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { canDerive, makeDerivatives, makePrintCopy, VIEW_MAX } from "@/lib/derivatives";
import { listArchiveImages, listGalleryImages, signBookImage } from "@/lib/book/book.functions";
import type { BookImage, ImageRef } from "@/lib/book/types";

export type PickedImage = { ref: ImageRef; preview: BookImage };

const naturalSize = (url: string) =>
  new Promise<{ w: number; h: number }>((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => res({ w: 0, h: 0 });
    im.src = url;
  });

export function ImagePicker({ bookId, onClose, onPick }: { bookId: string; onClose: () => void; onPick: (p: PickedImage) => void }) {
  const [fh, setFh] = useState("");
  const [archive, setArchive] = useState<Awaited<ReturnType<typeof listArchiveImages>> | null>(null);
  const [busy, setBusy] = useState(false);
  const gallery = useQuery({ queryKey: ["book-gallery-images"], queryFn: () => listGalleryImages() });

  async function findArchive() {
    if (!fh.trim()) return;
    setBusy(true);
    try {
      setArchive(await listArchiveImages({ data: { archiveId: fh } }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!canDerive(file)) return toast.error("Please choose a JPEG, PNG, TIFF or similar image.");
    setBusy(true);
    try {
      const d = await makeDerivatives(file);
      const print = await makePrintCopy(file, null);
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(0, 80);
      const base = `pages/${bookId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}`;
      const printPath = `${base}_print.jpg`;
      const viewPath = `${base}_view.jpg`;
      const a = await supabase.storage.from("book-images").upload(printPath, print.blob, { contentType: "image/jpeg" });
      if (a.error) throw new Error(a.error.message);
      const b = await supabase.storage.from("book-images").upload(viewPath, d.view.blob, { contentType: "image/jpeg" });
      if (b.error) throw new Error(b.error.message);
      const { url } = await signBookImage({ data: { path: viewPath } });
      onPick({
        ref: { source: "upload", path: printPath, viewPath, name: file.name, w: print.width, h: print.height },
        preview: { fileId: printPath, label: file.name, path: printPath, source: "print", derivativeId: null, width: print.width, height: print.height, bucket: "book-images", previewUrl: url },
      });
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl sm:max-w-3xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Choose an image</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="archive">
          <TabsList>
            <TabsTrigger value="archive">From an FH record</TabsTrigger>
            <TabsTrigger value="gallery">Photo Gallery</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="archive" className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="FH0042" value={fh} onChange={(e) => setFh(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findArchive()} aria-label="FH record number" />
              <Button onClick={findArchive} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Show scans</Button>
            </div>
            {archive && !archive.found && <p className="text-sm text-muted-foreground">No record {archive.archiveId}.</p>}
            {archive?.found && !archive.images.length && <p className="text-sm text-muted-foreground">{archive.archiveId} has no scans yet.</p>}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {archive?.images.map((im) => (
                <button key={im.fileId} type="button" className="rounded border p-1 text-left text-xs hover:border-primary" onClick={() =>
                  onPick({
                    ref: { source: "archive", fileId: im.fileId, archiveId: archive.archiveId, label: im.label, w: im.w, h: im.h },
                    preview: { fileId: im.fileId, label: `${archive.archiveId} ${im.label}`, path: "", source: "view", derivativeId: null, width: im.w, height: im.h, previewUrl: im.url },
                  })
                }>
                  {im.url ? <img src={im.url} alt={im.label} className="aspect-[3/4] w-full object-contain" /> : <div className="aspect-[3/4] w-full bg-muted" />}
                  <span className="mt-1 block truncate">{im.label}</span>
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="gallery">
            {gallery.isLoading && <p className="text-sm text-muted-foreground">Loading photos…</p>}
            {gallery.data && !gallery.data.length && <p className="text-sm text-muted-foreground">The Photo Gallery is empty.</p>}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {gallery.data?.map((g) => (
                <button key={`${g.photoId}-${g.side}`} type="button" className="rounded border p-1 text-left text-xs hover:border-primary" onClick={async () => {
                  // The book uses the gallery's viewing copy (up to 2400 px on its long side).
                  const s = g.url ? await naturalSize(g.url) : { w: 0, h: 0 };
                  const k = s.w && s.h ? VIEW_MAX / Math.max(s.w, s.h) : 0;
                  const w = Math.round(s.w * k);
                  const h = Math.round(s.h * k);
                  onPick({
                    ref: { source: "gallery", photoId: g.photoId, side: g.side, label: g.label, w, h },
                    preview: { fileId: g.photoId, label: g.label, path: "", source: "view", derivativeId: null, width: w, height: h, previewUrl: g.url },
                  });
                }}>
                  {g.url ? <img src={g.url} alt={g.label} className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-muted" />}
                  <span className="mt-1 block truncate">{g.label}</span>
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="upload" className="space-y-2">
            <p className="text-sm text-muted-foreground">Uploads are kept with this book only, separate from the archive's scans. A full-resolution print copy (up to 6000 px) is made in this browser.</p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed p-8 text-sm hover:bg-muted/50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? "Preparing image…" : "Choose a file"}
              <input type="file" accept="image/*,.tif,.tiff" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            </label>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
