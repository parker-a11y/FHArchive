import { useId, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, ChevronLeft, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchDigitalFiles } from "@/lib/digital-files";
import { photoToken, imageUrlToken } from "@/lib/inline-photos";

type PickRecord = { kind: "letter" | "source"; id: string; identifier: string; title: string | null };

/**
 * Pages of a record in the same order the email renderer uses, so the page
 * number written into the token always resolves to the same image.
 */
async function letterPages(letterId: string) {
  const files = await fetchDigitalFiles(letterId);
  const pages: { url: string; label: string | null }[] = [];
  for (const f of files) {
    const jpegs = f.derivatives
      .filter((d) => d.kind === "jpeg" && d.status === "complete" && d.storage_path)
      .sort((a, b) => String(a.storage_path).localeCompare(String(b.storage_path)));
    const viewable = /^image\/(jpeg|png|webp|gif)$/i.test(f.master_mime ?? "");
    const count = jpegs.length ? jpegs.length : viewable ? 1 : 0;
    for (let i = 0; i < count; i++) {
      pages.push({
        url: f.pageThumbUrls[i] || f.pageUrls[i] || f.thumbUrl || f.viewUrl,
        label: f.label || f.original_filename,
      });
    }
  }
  return pages;
}

async function sourcePages(sourceId: string) {
  const { data } = await supabase
    .from("ds_files")
    .select("storage_path, mime_type, original_filename, sort_order")
    .eq("source_id", sourceId)
    .order("sort_order", { ascending: true });
  const images = ((data ?? []) as Record<string, unknown>[]).filter((f) =>
    /^image\//i.test(String(f['mime_type'] ?? "")),
  );
  return Promise.all(
    images.map(async (f) => {
      const { data: signed } = await supabase.storage
        .from("ds-files")
        .createSignedUrl(String(f['storage_path']), 3600);
      return {
        url: signed?.signedUrl ?? "",
        label: f['original_filename'] == null ? null : String(f['original_filename']),
      };
    }),
  );
}

/** Lets an archivist drop any archive image into the text they are writing. */
export function ArchivePhotoPicker({
  onInsert,
  trigger,
}: {
  onInsert: (token: string) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const captionId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickRecord | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const searching = query.trim().length >= 2;

  const { data: gallery = [] } = useQuery({
    queryKey: ["photo-picker-gallery"],
    enabled: open && !searching,
    queryFn: async (): Promise<PickRecord[]> => {
      const { data } = await supabase
        .from("letters")
        .select("id, archive_id, title, created_at")
        .eq("record_type", "photograph")
        .order("created_at", { ascending: false })
        .limit(40);
      return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
        kind: "letter" as const,
        id: String(l['id']),
        identifier: String(l['archive_id']),
        title: l['title'] == null ? null : String(l['title']),
      }));
    },
  });

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["photo-picker-search", query.trim()],
    enabled: open && searching,
    queryFn: async (): Promise<PickRecord[]> => {
      const q = query.trim().replace(/[%,]/g, "");
      const [letters, sources] = await Promise.all([
        supabase
          .from("letters")
          .select("id, archive_id, title")
          .or(
            `archive_id.ilike.%${q}%,title.ilike.%${q}%,author.ilike.%${q}%,recipient.ilike.%${q}%,primary_person.ilike.%${q}%`,
          )
          .order("archive_id", { ascending: true })
          .limit(25),
        supabase
          .from("digital_sources")
          .select("id, ds_id, title")
          .or(`ds_id.ilike.%${q}%,title.ilike.%${q}%`)
          .limit(15),
      ]);
      return [
        ...((letters.data ?? []) as Record<string, unknown>[]).map((l) => ({
          kind: "letter" as const,
          id: String(l['id']),
          identifier: String(l['archive_id']),
          title: l['title'] == null ? null : String(l['title']),
        })),
        ...((sources.data ?? []) as Record<string, unknown>[]).map((s) => ({
          kind: "source" as const,
          id: String(s['id']),
          identifier: String(s['ds_id']),
          title: s['title'] == null ? null : String(s['title']),
        })),
      ];
    },
  });

  const { data: pages = [], isFetching: loadingPages } = useQuery({
    queryKey: ["photo-picker-pages", selected?.kind, selected?.id],
    enabled: open && Boolean(selected),
    queryFn: () => {
      if (!selected) return [];
      return selected.kind === "letter" ? letterPages(selected.id) : sourcePages(selected.id);
    },
  });

  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string } | null>(null);
  const stageFile = (file: File) => {
    if (!/^image\//i.test(file.type)) {
      setUploadError("Please choose an image file (JPG, PNG, etc.).");
      return;
    }
    setUploadError(null);
    setPendingFile({ file, preview: URL.createObjectURL(file) });
  };
  const cancelUpload = () => {
    if (pendingFile) URL.revokeObjectURL(pendingFile.preview);
    setPendingFile(null);
  };
  const confirmUpload = async () => {
    if (!pendingFile) return;
    const { file } = pendingFile;
    setUploading(true);
    setUploadError(null);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("uploaded-images")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      // Long-lived signed link (1 year) so the image keeps working in sent emails.
      const { data: signed, error: signErr } = await supabase.storage
        .from("uploaded-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not create image link");
      onInsert(imageUrlToken(signed.signedUrl, caption));
      setCaption("");
      cancelUpload();
      setOpen(false);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const insertUrl = () => {
    const u = imageUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) return;
    onInsert(imageUrlToken(u, caption));
    setImageUrl("");
    setCaption("");
    setOpen(false);
  };
  const insert = (page: number) => {
    if (!selected) return;
    onInsert(photoToken(selected.identifier, page, caption));
    setCaption("");
    setOpen(false);
    setSelected(null);
    setSelectedPage(null);
    setQuery("");
  };

  const list = searching ? results : gallery;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <ImagePlus className="size-4" /> Insert photo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Insert a photo from the archive</DialogTitle>
          <DialogDescription>
            Search for a record, or pick from the photographs below. The picture is placed where
            your cursor is, captioned with its record number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 rounded-md border border-archive-gold/40 bg-secondary/40 p-3">
          <label htmlFor={captionId} className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Title under the photo <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <Input
            id={captionId}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            placeholder="e.g. Skip on the dock at Ft Schuyler, 1943"
          />
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insertUrl();
              }
            }}
            placeholder="Or paste an image web address (https://…)"
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button type="button" size="sm" onClick={insertUrl} disabled={!/^https?:\/\/\S+$/i.test(imageUrl.trim())}>
            Insert URL
          </Button>
        </div>
        {imageUrl && /^https?:\/\/\S+$/i.test(imageUrl.trim()) ? (
          <img src={imageUrl.trim()} alt="Preview" className="max-h-40 rounded border border-border object-contain" />
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Choose an image file
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) stageFile(f);
              e.target.value = "";
            }}
          />
          <span className="text-xs text-muted-foreground">
            Stored as an uploaded image — no archive record is created.
          </span>
        </div>
        {pendingFile ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <img
              src={pendingFile.preview}
              alt="Upload preview"
              className="max-h-48 rounded border border-border object-contain"
            />
            <p className="truncate text-xs text-muted-foreground">{pendingFile.file.name}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => void confirmUpload()} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : null}
                {uploading ? "Uploading…" : "Insert this image"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancelUpload} disabled={uploading}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}

        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => {
                setSelected(null);
                setSelectedPage(null);
              }}>
                <ChevronLeft className="size-4" /> Back
              </Button>
              <span className="text-sm">
                <span className="archive-id font-semibold">{selected.identifier}</span>
                {selected.title ? ` — ${selected.title}` : ""}
              </span>
            </div>
            {loadingPages ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading images…
              </div>
            ) : pages.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                This record has no images that can be embedded.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {pages.map((p, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant="outline"
                    aria-label={`Select image ${i + 1}: ${p.label ?? `Page ${i + 1}`}`}
                    aria-pressed={selectedPage === i + 1}
                    onClick={() => setSelectedPage(i + 1)}
                    className={`group block h-auto min-w-0 rounded border p-1 text-left hover:border-archive-gold ${selectedPage === i + 1 ? "border-archive-gold bg-secondary ring-2 ring-archive-gold" : "border-border"}`}
                  >
                    <img
                      src={p.url}
                      alt={p.label ?? `Page ${i + 1}`}
                      className="h-28 w-full rounded object-cover"
                      loading="lazy"
                    />
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                      {p.label ?? `Page ${i + 1}`}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by FH / DS number, title or person…"
            />
            <p className="text-xs text-muted-foreground">
              {searching
                ? isFetching
                  ? "Searching…"
                  : `${results.length} matching records`
                : "Photographs in the archive"}
            </p>
            <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
              {list.map((r) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  onClick={() => setSelected(r)}
                  className="flex w-full items-center gap-3 rounded border border-transparent px-2 py-2 text-left text-sm hover:border-border hover:bg-secondary"
                >
                  <span className="archive-id font-semibold text-archive-gold">{r.identifier}</span>
                  <span className="truncate text-muted-foreground">{r.title ?? "Untitled"}</span>
                </button>
              ))}
              {list.length === 0 && (
                <p className="py-6 text-sm text-muted-foreground">
                  {searching ? "No records matched." : "No photographs catalogued yet — search above."}
                </p>
              )}
            </div>
          </div>
        )}
        {selected && pages.length > 0 ? (
          <div className="sticky -bottom-6 flex justify-end border-t border-border bg-background py-3">
            <Button
              type="button"
              disabled={selectedPage === null || loadingPages}
              onClick={() => {
                if (selectedPage !== null) insert(selectedPage);
              }}
            >
              <ImagePlus className="size-4" /> Insert selected image
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Inserts text at the caret of a textarea and returns the new value. */
export function insertAtCursor(el: HTMLTextAreaElement | null, current: string, text: string) {
  if (!el) return `${current}${current && !current.endsWith("\n") ? "\n\n" : ""}${text}\n`;
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? start;
  const before = current.slice(0, start);
  const after = current.slice(end);
  const padded = `${before}${before && !before.endsWith("\n") ? "\n\n" : ""}${text}\n\n${after.replace(/^\n+/, "")}`;
  requestAnimationFrame(() => {
    const pos = padded.length - after.replace(/^\n+/, "").length;
    el.focus();
    el.setSelectionRange(pos, pos);
  });
  return padded;
}
