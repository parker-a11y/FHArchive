/**
 * Photo-first record view. The image leads; a few editable facts sit beside it
 * and everything archival stays available behind "Show all archival fields".
 *
 * All editing runs through the parent route's form state and save handler —
 * there is no second save path here.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaLightbox, type LightboxItem } from "@/components/ui/media-lightbox";
import { fetchDigitalFiles, pageViewerEntries } from "@/lib/digital-files";
import { PHOTO_MEDIUMS } from "./photo-fields";

type FormValue = string | boolean;

export function PhotoRecordView({
  letterId,
  archiveId,
  form,
  set,
}: {
  letterId: string;
  archiveId: string;
  form: Record<string, FormValue>;
  set: (key: string, value: FormValue) => void;
}) {
  const { data: files } = useQuery({
    queryKey: ["catalog-thumbnails", letterId],
    queryFn: () => fetchDigitalFiles(letterId),
    staleTime: 30_000,
  });
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const entries = pageViewerEntries(files ?? []).filter((e) => e.url);
  const items: LightboxItem[] = entries.map((e) => ({
    id: `${e.fileId}#${e.page}`,
    url: e.url,
    type: "image" as const,
    title: e.file.label || e.file.original_filename || "Photograph",
    subtitle: `${archiveId} · viewing derivative`,
    filename: e.file.original_filename,
    rotation: e.file.rotation ?? 0,
  }));
  const s = (k: string) => (form[k] as string) ?? "";

  return (
    <div className="max-w-5xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[22rem_1fr]">
        <div>
          {entries.length ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setViewerIndex(0);
                  setViewerOpen(true);
                }}
                className="block w-full overflow-hidden rounded-md border border-border bg-card shadow-sm transition hover:border-primary"
              >
                <img
                  src={entries[0].url}
                  alt={s("title") || `Photograph ${archiveId}`}
                  className="max-h-[26rem] w-full object-contain"
                />
              </button>
              {entries.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {entries.map((e, i) => (
                    <button
                      key={`${e.fileId}#${e.page}`}
                      type="button"
                      onClick={() => {
                        setViewerIndex(i);
                        setViewerOpen(true);
                      }}
                      className="shrink-0 overflow-hidden rounded border border-border hover:border-primary"
                    >
                      <img src={e.thumbUrl} alt="" className="h-16 w-auto object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Click the photo for full-screen viewing, zoom and rotate.
              </p>
            </>
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
              No image yet — upload it under Scans &amp; Files.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="field-label">Caption / short description</Label>
            <Input value={s("title")} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="field-label">Date</Label>
              <Input
                type="date"
                value={s("normalized_date")}
                onChange={(e) => set("normalized_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Occasion / event</Label>
              <Input
                value={s("photo_occasion")}
                onChange={(e) => set("photo_occasion", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="field-label">Photographer / studio</Label>
              <Input
                value={s("photographer")}
                onChange={(e) => set("photographer", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Print size</Label>
              <Input value={s("print_size")} onChange={(e) => set("print_size", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Black &amp; white or color</Label>
              <select
                value={s("photo_medium")}
                onChange={(e) => set("photo_medium", e.target.value)}
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              >
                {PHOTO_MEDIUMS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="field-label">Writing on the back</Label>
            <Textarea
              rows={3}
              value={s("photo_back_inscription")}
              onChange={(e) => set("photo_back_inscription", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              People pictured and places are managed under People · Places · Keywords.
            </p>
          </div>
        </div>
      </div>

      <MediaLightbox
        items={items}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
