import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Quote, ArrowUpDown, Search, Bomb } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { displayDate } from "@/lib/archive";
import { DateLink } from "@/components/DateLink";
import { HighlightedText } from "@/lib/highlight";
import {
  fetchQuotations,
  findQuoteSource,
  quoteTime,
  removeQuotation,
  type Quotation,
} from "@/lib/quotations";
import { fetchDigitalFiles } from "@/lib/digital-files";

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({
    meta: [
      { title: "Important Quotations — The Francis Files" },
      {
        name: "description",
        content:
          "Every notable quotation surfaced by AI analysis across The Francis Files, sorted by the date of the record it came from.",
      },
      { property: "og:title", content: "Important Quotations — The Francis Files" },
      {
        property: "og:description",
        content: "A running table of notable quotations drawn from the archive's transcriptions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <QuotationsPage />
    </AppShell>
  ),
});

function QuotationsPage() {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotations"],
    queryFn: fetchQuotations,
  });
  const [q, setQ] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [includePending, setIncludePending] = useState(false);
  const [open, setOpen] = useState<Quotation | null>(null);
  const [toRemove, setToRemove] = useState<Quotation | null>(null);
  const [removing, setRemoving] = useState(false);

  async function confirmRemove() {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await removeQuotation(toRemove.id, toRemove.quote);
      await queryClient.invalidateQueries({ queryKey: ["quotations"] });
      await queryClient.invalidateQueries({ queryKey: ["ai-suggestions", toRemove.letter_id] });
      toast.success("Quotation removed");
      setToRemove(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the quotation");
    } finally {
      setRemoving(false);
    }
  }

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = quotes.filter((x) => {
      if (!includePending && x.status !== "accepted") return false;
      if (!term) return true;
      return [x.quote, x.archive_id, x.title, x.author, x.recipient]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
    return filtered.sort((a, b) => {
      const ta = quoteTime(a);
      const tb = quoteTime(b);
      if (ta === null && tb === null) return a.archive_id.localeCompare(b.archive_id);
      if (ta === null) return 1;
      if (tb === null) return -1;
      return newestFirst ? tb - ta : ta - tb;
    });
  }, [quotes, q, newestFirst, includePending]);

  const pendingCount = quotes.filter((x) => x.status !== "accepted").length;

  return (
    <>
      <PageHeader
        title="Important Quotations"
        description="Notable passages drawn from AI analysis across the archive, ordered by record date."
      />
      <div className="p-4 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search quotations, FH number, person…"
              className="pl-9"
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setNewestFirst((v) => !v)}>
            <ArrowUpDown className="size-4" />
            {newestFirst ? "Newest first" : "Oldest first"}
          </Button>
          {pendingCount > 0 && (
            <Button
              variant={includePending ? "default" : "outline"}
              onClick={() => setIncludePending((v) => !v)}
            >
              Include unreviewed ({pendingCount})
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground">{rows.length} quotations</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No quotations yet. Run AI analysis on a record to collect them.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <div key={row.key} className="flex items-start transition-colors hover:bg-muted/60">
                  <button
                    type="button"
                    onClick={() => setOpen(row)}
                    className="flex min-w-0 flex-1 items-start gap-4 px-4 py-3 text-left"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tone-plum-soft text-tone-plum">
                      <Quote className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">
                        <HighlightedText text={`“${row.quote}”`} term={q.trim() || undefined} />
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="archive-id text-sm">{row.archive_id}</span>
                        <span onClick={(e) => e.stopPropagation()}>
                          <DateLink date={row.normalized_date}>{displayDate(row)}</DateLink>
                        </span>
                        <span className="truncate">
                          {row.title || `${row.author || "—"} → ${row.recipient || "—"}`}
                        </span>
                        {row.status !== "accepted" && (
                          <span className="rounded-full bg-tone-ochre-soft px-2 py-0.5 text-tone-ochre">
                            unreviewed
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-2 mr-2 shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove this quotation"
                      aria-label="Remove this quotation"
                      onClick={() => setToRemove(row)}
                    >
                      <Bomb className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <QuoteDetailDialog quote={open} onClose={() => setOpen(null)} />

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && !removing && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be deleted from {toRemove?.archive_id} and will no longer appear in this list.
              The transcription itself is untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {toRemove && (
            <blockquote className="rounded-lg border-l-4 border-archive-gold bg-muted/40 px-3 py-2 text-sm italic">
              “{toRemove.quote}”
            </blockquote>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void confirmRemove();
              }}
            >
              {removing ? "Removing…" : "Remove quotation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function QuoteDetailDialog({ quote, onClose }: { quote: Quotation | null; onClose: () => void }) {
  const letterId = quote?.letter_id ?? "";
  const { data: source, isLoading } = useQuery({
    queryKey: ["quote-source", letterId, quote?.key],
    queryFn: () => findQuoteSource(letterId, quote!.quote),
    enabled: !!quote,
  });
  const { data: files = [] } = useQuery({
    queryKey: ["catalog-thumbnails", letterId],
    queryFn: () => fetchDigitalFiles(letterId),
    enabled: !!quote,
    staleTime: 30_000,
  });

  const file = source?.fileId ? files.find((f) => f.id === source.fileId) : files[0];
  const matchedPage = !!source?.fileId;

  return (
    <Dialog open={!!quote} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {quote?.archive_id} —{" "}
            {quote ? <DateLink date={quote.normalized_date}>{displayDate(quote)}</DateLink> : ""}
          </DialogTitle>
        </DialogHeader>
        {quote && (
          <div className="space-y-4">
            <blockquote className="rounded-xl border-l-4 border-archive-gold bg-muted/40 px-4 py-3 text-base leading-relaxed italic">
              “{quote.quote}”
            </blockquote>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="field-label mb-2">Scan</div>
                {file?.viewUrl || file?.thumbUrl ? (
                  <>
                    <img
                      src={file.viewUrl || file.thumbUrl}
                      alt={`Scan for ${quote.archive_id}`}
                      className="w-full rounded-lg border border-border object-contain"
                      loading="lazy"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {matchedPage
                        ? `Page ${(source?.pageIndex ?? 0) + 1}${source?.pageLabel ? ` (${source.pageLabel})` : ""} — the page containing this quote.`
                        : "No single page matched this quote; showing the record's first scan."}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No scan available for this record.</p>
                )}
              </div>
              <div>
                <div className="field-label mb-2">Transcription</div>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : source?.text ? (
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-card p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    <HighlightedText text={source.text} term={quote.quote} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No transcription text found.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/letters/$archiveId" params={{ archiveId: quote.archive_id }}>
                  Open record
                </Link>
              </Button>
              <Button asChild>
                <Link
                  to="/letters/$archiveId"
                  params={{ archiveId: quote.archive_id }}
                  search={{ tab: "transcription", hl: quote.quote }}
                >
                  Open transcription at this quote
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
