/**
 * Renders archive text with Francis File Note terms recognised.
 *
 * The stored text is never modified — matching happens here, at display time,
 * against the published alias index. Only the first occurrence of each note
 * inside one block is marked so a paragraph never looks heavily annotated.
 */
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFfnImageUrls } from "@/lib/ffn-images";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  fetchAliasIndex,
  fetchImages,
  fetchNote,
  fetchRelatedNotes,
  noteTitle,
  type FfnNote,
} from "@/lib/ffn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function useAliasIndex() {
  return useQuery({
    queryKey: ["ffn-alias-index"],
    queryFn: fetchAliasIndex,
    staleTime: 5 * 60 * 1000,
  });
}

/** Splits `text` into plain strings and recognised note terms. */
function annotate(
  text: string,
  entries: { alias: string; noteId: string }[],
  notes: Record<string, FfnNote>,
  searchTerm?: string,
): ReactNode[] {
  const plain = (value: string, key: string): ReactNode => {
    if (!searchTerm?.trim()) return value;
    const pieces = value.split(new RegExp(`(${escapeRe(searchTerm.trim())})`, "gi"));
    return (
      <Fragment key={key}>
        {pieces.map((piece, index) =>
          index % 2 ? (
            <mark key={index} className="rounded bg-yellow-200 px-0.5 text-foreground">
              {piece}
            </mark>
          ) : (
            <Fragment key={index}>{piece}</Fragment>
          ),
        )}
      </Fragment>
    );
  };
  if (!text || !entries.length) return [plain(text, "plain")];
  // Longest aliases first so "USS Doyle C. Barnes" wins over "Barnes".
  const pattern = [...entries]
    .sort((a, b) => b.alias.length - a.alias.length)
    .map((e) => escapeRe(e.alias))
    .join("|");
  let re: RegExp;
  try {
    re = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, "giu");
  } catch {
    return [text];
  }
  const byNorm = new Map(entries.map((e) => [e.alias.toLowerCase(), e.noteId]));
  const out: ReactNode[] = [];
  const used = new Set<string>();
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    const noteId = byNorm.get(m[0].toLowerCase());
    const note = noteId ? notes[noteId] : undefined;
    if (!note || used.has(note.id)) continue;
    used.add(note.id);
    if (m.index > last) out.push(plain(text.slice(last, m.index), `plain-${key}`));
    out.push(<FfnTerm key={`ffn-${key++}`} note={note} label={m[0]} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(plain(text.slice(last), `plain-${key}`));
  return out;
}

/** Plain archive text with Francis File Note terms made interactive. */
export function FfnText({ text, searchTerm }: { text: string; searchTerm?: string }) {
  const { data } = useAliasIndex();
  const nodes = useMemo(
    () => annotate(text, data?.entries ?? [], data?.notes ?? {}, searchTerm),
    [text, data, searchTerm],
  );
  return <>{nodes}</>;
}

/** Linked reading preview for plain-text editing fields. Hidden when no published term matches. */
export function FfnPreview({ text }: { text: string }) {
  const { data } = useAliasIndex();
  const hasMatch = useMemo(() => {
    if (!text.trim() || !data?.entries.length) return false;
    return data.entries.some(({ alias }) => {
      try {
        return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(alias)}(?![\\p{L}\\p{N}])`, "iu").test(text);
      } catch {
        return false;
      }
    });
  }, [data, text]);
  if (!hasMatch) return null;
  return (
    <div className="mt-2 rounded border border-archive-gold/30 bg-archive-note/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
      <div className="field-label mb-1.5">Published Notes preview</div>
      <FfnText text={text} />
    </div>
  );
}

function FfnTerm({ note, label }: { note: FfnNote; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Francis File Note: ${noteTitle(note)}`}
          className="ffn-term cursor-pointer rounded-[2px] bg-archive-note px-[1px] underline decoration-dotted decoration-1 underline-offset-[3px] transition-colors hover:bg-archive-note-hover focus-visible:ring-2 focus-visible:ring-archive-gold focus-visible:outline-none"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,92vw)] p-0">
        <NoteCard slug={note.slug} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** Compact popover body: definition, context, image, related, full-page link. */
export function NoteCard({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { data: note } = useQuery({ queryKey: ["ffn-note", slug], queryFn: () => fetchNote(slug) });
  const { data: images = [] } = useQuery({
    queryKey: ["ffn-images", note?.id],
    queryFn: () => fetchImages(note!.id),
    enabled: !!note?.id,
  });
  const { data: related = [] } = useQuery({
    queryKey: ["ffn-related", note?.id],
    queryFn: () => fetchRelatedNotes(note!.id),
    enabled: !!note?.id,
  });

  const imageUrl = useFfnImageUrls(images);

  if (!note) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  const primary = images.find((i) => i.is_primary) ?? images[0];


  return (
    <div className="max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-[11px] font-bold tracking-[0.16em] text-archive-gold uppercase">
          Francis File Note
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-display text-lg leading-tight font-semibold">{noteTitle(note)}</h3>
          {note.expanded_name && (
            <p className="text-sm font-medium text-muted-foreground">{note.expanded_name}</p>
          )}
        </div>
        {note.short_definition && <p className="text-sm leading-relaxed">{note.short_definition}</p>}
        {note.archive_context && (
          <p className="border-l-2 border-archive-gold/50 pl-3 text-sm leading-relaxed text-muted-foreground">
            {note.archive_context}
          </p>
        )}
        {primary && imageUrl(primary) && (
          <figure className="space-y-1">
            <img
              src={imageUrl(primary)}
              alt={primary.caption ?? noteTitle(note)}
              loading="lazy"
              className="w-full rounded border border-border object-cover"
            />
            {(primary.caption || primary.credit) && (
              <figcaption className="text-xs text-muted-foreground">
                {[primary.caption, primary.credit].filter(Boolean).join(" · ")}
              </figcaption>
            )}
          </figure>
        )}
        {related.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {related.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                to="/notes/$slug"
                params={{ slug: r.slug }}
                className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
              >
                {noteTitle(r)}
              </Link>
            ))}
          </div>
        )}
        {note.appearance_count > 0 && (
          <p className="text-xs text-muted-foreground">
            Appears in {note.appearance_count} Francis File
            {note.appearance_count === 1 ? "" : "s"}
          </p>
        )}
        <Button asChild size="sm" className="w-full">
          <Link to="/notes/$slug" params={{ slug: note.slug }}>
            View Full Francis File Note →
          </Link>
        </Button>
      </div>
    </div>
  );
}
