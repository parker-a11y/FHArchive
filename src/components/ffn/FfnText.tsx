/**
 * Renders archive text with Francis File Note terms recognised.
 *
 * The stored text is never modified — matching happens here, at display time,
 * against the published alias index. Only the first occurrence of each note
 * inside one block is marked so a paragraph never looks heavily annotated.
 */
import { Fragment, type ReactNode, useMemo, useRef, useState } from "react";
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
import {
  CPI_YEARS,
  LATEST_CPI_YEAR,
  convertMoney,
  parseMoneyMentions,
} from "@/lib/money";

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
  year?: number,
  estimatedYear = false,
): ReactNode[] {
  const searched = (value: string, key: string): ReactNode => {
    if (!searchTerm?.trim()) return <Fragment key={key}>{value}</Fragment>;
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
  const plain = (value: string, key: string): ReactNode => {
    const mentions = parseMoneyMentions(value);
    if (!mentions.length) return searched(value, key);
    const result: ReactNode[] = [];
    let cursor = 0;
    mentions.forEach((mention, index) => {
      if (mention.start > cursor)
        result.push(searched(value.slice(cursor, mention.start), `${key}-text-${index}`));
      result.push(
        <MoneyTerm
          key={`${key}-money-${index}`}
          label={mention.original}
          amountCents={mention.amountCents}
          year={year}
          estimatedYear={estimatedYear}
        />,
      );
      cursor = mention.end;
    });
    if (cursor < value.length) result.push(searched(value.slice(cursor), `${key}-tail`));
    return <Fragment key={key}>{result}</Fragment>;
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
export function FfnText({
  text,
  searchTerm,
  year,
  estimatedYear = false,
}: {
  text: string;
  searchTerm?: string;
  year?: number;
  estimatedYear?: boolean;
}) {
  const { data } = useAliasIndex();
  const nodes = useMemo(
    () => annotate(text, data?.entries ?? [], data?.notes ?? {}, searchTerm, year, estimatedYear),
    [text, data, searchTerm, year, estimatedYear],
  );
  return <>{nodes}</>;
}

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function presentDollars(value: number) {
  const rounded = value >= 100 ? Math.round(value) : value >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: rounded < 100 ? 2 : 0,
  }).format(rounded);
}

/** An unobtrusive currency marker whose popover works by hover, tap and keyboard. */
function MoneyTerm({
  label,
  amountCents,
  year,
  estimatedYear,
}: {
  label: string;
  amountCents: number;
  year?: number;
  estimatedYear: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | "">(year ?? "");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const converted = selectedYear ? convertMoney(amountCents, selectedYear) : null;
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: estimate value in today's dollars`}
          className="money-term cursor-pointer rounded-[2px] px-[1px] underline decoration-dotted underline-offset-[3px] focus-visible:ring-2 focus-visible:ring-archive-gold focus-visible:outline-none"
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          onClick={(event) => {
            // Money can appear inside a linked search excerpt; open the card instead of navigating.
            event.preventDefault();
            event.stopPropagation();
            setOpen((value) => !value);
          }}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(21rem,92vw)] p-4"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] text-archive-gold uppercase">
              Historical money
            </div>
            <div className="mt-1 text-sm">Original amount: <strong>{dollars(amountCents)}</strong></div>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Year of amount
            <select
              className="mt-1 block h-9 w-full rounded border border-input bg-background px-2 text-sm text-foreground"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value ? Number(event.target.value) : "")}
            >
              <option value="">Select a year</option>
              {CPI_YEARS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {converted == null ? (
            <p className="text-sm text-muted-foreground">Choose the year this amount was written to estimate its value today.</p>
          ) : (
            <div className="rounded border border-border bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Approximate value in {LATEST_CPI_YEAR} dollars</div>
              <div className="font-display text-2xl font-semibold">{presentDollars(converted)}</div>
              {estimatedYear && selectedYear === year && (
                <div className="mt-1 text-xs text-muted-foreground">Using the record’s estimated date.</div>
              )}
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Estimate based on annual U.S. CPI-U from the Bureau of Labor Statistics. Purchasing power varies by item and location.
          </p>
        </div>
      </PopoverContent>
    </Popover>
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
