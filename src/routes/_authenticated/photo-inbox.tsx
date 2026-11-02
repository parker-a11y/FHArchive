import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Trash2, UploadCloud } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhotoIntakeForm } from "@/components/photo/PhotoIntakeForm";
import { supabase } from "@/integrations/supabase/client";
import { previewNextArchiveId } from "@/lib/queries";
import {
  fetchUnassignedPhotos,
  removeUnassignedPhotos,
  unassignedAsFile,
  uploadUnassignedPhoto,
  type UnassignedPhoto,
} from "@/lib/unassigned-photos";

const inboxOptions = queryOptions({ queryKey: ["unassigned-photos"], queryFn: fetchUnassignedPhotos });

export const Route = createFileRoute("/_authenticated/photo-inbox")({
  head: () => ({
    meta: [
      { title: "Unassigned Photos — The Francis Files" },
      { name: "description", content: "Bulk-uploaded photographs waiting to become FH records." },
      { property: "og:title", content: "Unassigned Photos — The Francis Files" },
      { property: "og:description", content: "Bulk-uploaded photographs waiting to become FH records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(inboxOptions),
  pendingComponent: () => (
    <AppShell>
      <PageHeader title="Unassigned Photos" />
      <p className="p-8 text-sm text-muted-foreground">Loading photos…</p>
    </AppShell>
  ),
  errorComponent: ({ reset }) => (
    <AppShell>
      <PageHeader title="Unassigned Photos" />
      <div className="space-y-3 p-8">
        <p>Photos could not be loaded.</p>
        <Button variant="outline" onClick={reset}>Try again</Button>
      </div>
    </AppShell>
  ),
  component: () => (
    <AppShell>
      <PhotoInbox />
    </AppShell>
  ),
});

function Thumb({ photo }: { photo: UnassignedPhoto }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from("scans")
      .createSignedUrl(photo.storage_path, 3600, { transform: { width: 400, height: 400, resize: "contain" } })
      .then(({ data }) => alive && setUrl(data?.signedUrl ?? ""));
    return () => {
      alive = false;
    };
  }, [photo.storage_path]);
  return url ? (
    <img src={url} alt={photo.original_filename} className="h-full w-full object-contain" loading="lazy" />
  ) : (
    <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
      {photo.original_filename}
    </div>
  );
}

function PhotoInbox() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: photos } = useSuspenseQuery(inboxOptions);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [intake, setIntake] = useState<{ front: File; back: File | null; used: UnassignedPhoto[] } | null>(null);
  const [opening, setOpening] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["unassigned-photos"] });

  async function upload(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(tiff?|jpe?g|png|heic)$/i.test(f.name));
    if (!imgs.length) return;
    setUploading({ done: 0, total: imgs.length });
    let failed = 0;
    for (const [i, f] of imgs.entries()) {
      try {
        await uploadUnassignedPhoto(f);
      } catch (e) {
        failed++;
        toast.error((e as Error).message);
      }
      setUploading({ done: i + 1, total: imgs.length });
    }
    setUploading(null);
    refresh();
    toast.success(`${imgs.length - failed} photo${imgs.length - failed === 1 ? "" : "s"} added to the bucket`);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));
  }

  async function createRecord() {
    const used = selected.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as UnassignedPhoto[];
    if (!used.length) return;
    setOpening(true);
    try {
      const [front, back] = await Promise.all([unassignedAsFile(used[0]), used[1] ? unassignedAsFile(used[1]) : null]);
      setNext((await previewNextArchiveId()).archive_id);
      setIntake({ front, back, used });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOpening(false);
    }
  }

  async function remove() {
    const used = photos.filter((p) => selected.includes(p.id));
    if (!used.length || !confirm(`Delete ${used.length} photo(s) from the bucket? This cannot be undone.`)) return;
    await removeUnassignedPhotos(used);
    setSelected([]);
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Unassigned Photos"
        description="Drop photos here in bulk. Later, pick one (front) or two (front + back) to create an FH record."
      />
      <div className="space-y-5 p-4 sm:p-8">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.tif,.tiff"
          className="hidden"
          onChange={(e) => {
            upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            upload(Array.from(e.dataTransfer.files ?? []));
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center text-sm ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="mb-2 size-6 animate-spin" />
              Uploading {uploading.done} of {uploading.total}…
            </>
          ) : (
            <>
              <UploadCloud className="mb-2 size-6 text-muted-foreground" />
              Drag photos here, or click to choose many at once
            </>
          )}
        </div>

        <div className="sticky top-[53px] z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 py-2 backdrop-blur lg:top-0">
          <span className="text-sm text-muted-foreground">
            {photos.length} waiting · {selected.length ? `${selected.length} selected (first = front, second = back)` : "tap a photo to select"}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" disabled={!selected.length || opening} onClick={createRecord}>
              {opening ? "Opening…" : "Create record"}
            </Button>
            <Button size="sm" variant="outline" disabled={!selected.length} onClick={remove}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </div>

        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">The bucket is empty.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => {
              const idx = selected.indexOf(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={idx >= 0}
                  className={`relative aspect-square overflow-hidden rounded border-2 bg-card ${
                    idx >= 0 ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <Thumb photo={p} />
                  {idx >= 0 && (
                    <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      <Check className="size-3" /> {idx === 0 ? "Front" : "Back"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!intake} onOpenChange={(o) => !o && setIntake(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create photo record</DialogTitle>
          </DialogHeader>
          {intake && (
            <PhotoIntakeForm
              nextArchiveId={next}
              recordType="photograph"
              initialFront={intake.front}
              initialBack={intake.back}
              onSaved={async (created, ctx) => {
                try {
                  await removeUnassignedPhotos(intake.used);
                } catch (e) {
                  toast.error(`Record saved, but photos stayed in the bucket — ${(e as Error).message}`);
                }
                toast.success(`${created.archive_id} created`);
                setSelected([]);
                setIntake(null);
                refresh();
                qc.invalidateQueries({ queryKey: ["letters"] });
                if (ctx.mode !== "next") {
                  navigate({ to: "/letters/$archiveId", params: { archiveId: created.archive_id } });
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
