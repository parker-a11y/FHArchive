import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, ChevronLeft, Loader2 } from "lucide-react";
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
import { fetchDigitalFiles, signedScanUrl } from "@/lib/digital-files";
import { photoToken } from "@/lib/inline-photos";

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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickRecord | null>(null);
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
    queryFn: () =>
      selected!.kind === "letter" ? letterPages(selected!.id) : sourcePages(selected!.id),
  });

  const insert = (page: number) => {
    onInsert(photoToken(selected!.identifier, page));
    setOpen(false);
    setSelected(null);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insert a photo from the archive</DialogTitle>
          <DialogDescription>
            Search for a record, or pick from the photographs below. The picture is placed where
            your cursor is, captioned with its record number.
          </DialogDescription>
        </DialogHeader>

        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelected(null)}>
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
                  <button
                    key={i}
                    type="button"
                    onClick={() => insert(i + 1)}
                    className="group rounded border border-border p-1 text-left hover:border-archive-gold"
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
                  </button>
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
