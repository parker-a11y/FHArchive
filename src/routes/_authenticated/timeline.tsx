import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { useAuth } from "@/hooks/useAuth";
import { WRITER_MAX_RECORDS } from "@/lib/writer-limits";
import { Copy, Feather, Mail } from "lucide-react";
import { AssignCollectionsDialog, CollectionLabels } from '@/components/collections/CollectionControls';
import { toast } from "sonner";
import { fetchLetters } from "@/lib/queries";
import { transcriptionForCopy } from "@/lib/transcription-format";
import { supabase } from "@/integrations/supabase/client";
import { PERIODS, displayDate } from "@/lib/archive";
import { DateLink } from "@/components/DateLink";
import { WeekInHistory } from "@/components/WeekInHistory";
import { MonthInHistory } from "@/components/MonthInHistory";
import { timelineYears } from "@/lib/timeline-years";
import { recordHealth, HEALTH_COLORS } from "@/lib/record-health";
import { useAiStateByLetter } from "@/lib/record-ai-state";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — The Francis Files" },
      {
        name: "description",
        content:
          "Chronological timeline of The Francis Files letters with period, person, place and keyword filters.",
      },
      { property: "og:title", content: "Timeline — The Francis Files" },
      {
        property: "og:description",
        content: "Chronological view of the family letter correspondence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Timeline />
    </AppShell>
  ),
});

function Timeline() {
  const { isAdmin, canEdit } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const selectedRecords = useMemo(
    () => letters.filter((l) => selected.has(l.id)).map((l) => ({
      kind: "letter" as const,
      id: l.id,
      identifier: l.archive_id,
      title: l.title,
      date: l.normalized_date,
    })),
    [letters, selected],
  );
  const toggleSelected = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  // Copy every selected letter's transcription in one clipboard payload, each
  // headed by its catalog details so the text stays attributable when pasted
  // elsewhere.
  const [copying, setCopying] = useState(false);
  const copyTranscriptions = async () => {
    const chosen = letters.filter((l) => selected.has(l.id));
    if (chosen.length === 0) return;
    setCopying(true);
    try {
      // The timeline list query is slim and omits the transcription text, so
      // load it here only for the records being copied.
      const { data: texts, error } = await supabase
        .from("letters")
        .select("id, transcription_verified, transcription_rollup_text, transcription_raw_ai")
        .in("id", chosen.map((l) => l.id));
      if (error) throw error;
      const textById = new Map((texts ?? []).map((t) => [t.id, transcriptionForCopy(t)]));
      const blocks = chosen.map((l) => {
        const header = [
          `${l.archive_id}${l.title ? ` — ${l.title}` : ""}`,
          `Date: ${displayDate(l) || "Undated"}`,
          `From: ${l.author || "Unknown"}${l.origin ? ` (${l.origin})` : ""}`,
          `To: ${l.recipient || "Unknown"}${l.destination ? ` (${l.destination})` : ""}`,
        ].join("\n");
        const body =
          textById.get(l.id) ||
          "[No transcription yet]";
        return `${header}\n\n${body}`;
      });
      await navigator.clipboard.writeText(blocks.join("\n\n---\n\n"));
      toast.success(
        chosen.length === 1
          ? `Copied transcription of ${chosen[0].archive_id}`
          : `Copied transcriptions of ${chosen.length} records`,
      );
    } catch (e) {
      toast.error((e as Error).message || "Could not copy to clipboard");
    } finally {
      setCopying(false);
    }
  };

  // One action bar, shown both in the sticky filter bar and inside each
  // calendar section, so a selection made there is actionable where it was made.
  const selectionActions =
    canEdit && selectedRecords.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2" aria-label="Selected letter actions">
        <span className="text-sm font-medium">{selectedRecords.length} selected</span>
        <AssignCollectionsDialog records={selectedRecords} />
        {isAdmin && (
          <EmailArchiveDialog
            records={selectedRecords}
            trigger={
              <Button size="sm" className="gap-2">
                <Mail className="size-4" /> EMAIL RECORDS ({selectedRecords.length})
              </Button>
            }
          />
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={copying}
          onClick={copyTranscriptions}
        >
          <Copy className="size-4" />
          {copying ? "Copying…" : `Copy transcriptions (${selectedRecords.length})`}
        </Button>
        <Button asChild variant="outline" size="sm" className="h-auto min-h-8 gap-2 whitespace-normal text-left">
          <Link to="/writer" search={{ ids: selectedRecords.map((r) => r.identifier).join(",") }}>
            <Feather className="size-4 shrink-0" />
            {selectedRecords.length > WRITER_MAX_RECORDS
              ? `Write about records (first ${WRITER_MAX_RECORDS} of ${selectedRecords.length})`
              : `Write about records (${selectedRecords.length})`}
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear selection</Button>
      </div>
    ) : null;
  const { data: links = [] } = useQuery({
    queryKey: ["timeline_links"],
    queryFn: async () => {
      const [k, p, pl] = await Promise.all([
        supabase.from("letter_keywords").select("letter_id, keywords(name)"),
        supabase.from("letter_people").select("letter_id, people(name)"),
        supabase.from("letter_places").select("letter_id, places(canonical_name)"),
      ]);
      const map: Record<string, string[]> = {};
      const push = (id: string, v?: string | null) => v && (map[id] ??= []).push(v);
      (k.data ?? []).forEach((r) => push(r.letter_id, r.keywords?.name));
      (p.data ?? []).forEach((r) => push(r.letter_id, r.people?.name));
      (pl.data ?? []).forEach((r) => push(r.letter_id, r.places?.canonical_name));
      return [map] as Record<string, string[]>[];
    },
  });
  const tagMap = links[0] ?? {};

  // AI-analysis review state drives the purple/green distinction, exactly as on
  // All Records. Shared with the this-week and this-month calendars below.
  const { data: aiByLetter = {} } = useAiStateByLetter();

  const [period, setPeriod] = useState("");
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    return letters
      .filter((l) => (period ? l.period === period : true))
      .filter((l) =>
        filter
          ? [l.author, l.recipient, l.origin, ...(tagMap[l.id] ?? [])]
              .join(" ")
              .toLowerCase()
              .includes(filter.toLowerCase())
          : true,
      )
      .sort((a, b) => {
        if (!a.normalized_date) return 1;
        if (!b.normalized_date) return -1;
        return a.normalized_date < b.normalized_date ? -1 : 1;
      });
  }, [letters, period, filter, tagMap]);

  const years = useMemo(() => timelineYears(rows), [rows]);

  const barRef = useRef<HTMLDivElement | null>(null);
  const headingRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeYear, setActiveYear] = useState("");

  // Where the pinned filter/year bar sits once it is stuck to the top of the
  // viewport: its own sticky offset plus its height, so jumps land below it
  // whether or not the page has been scrolled yet.
  const jumpLine = () => {
    const bar = barRef.current;
    if (!bar) return 8;
    const stickyTop = parseFloat(getComputedStyle(bar).top) || 0;
    return stickyTop + bar.getBoundingClientRect().height + 8;
  };

  const jumpToYear = (year: string) => {
    const el = headingRefs.current[year];
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top - jumpLine();
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    setActiveYear(year);
  };

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const line = jumpLine() + 4;
        let current = "";
        for (const { year } of years) {
          const el = headingRefs.current[year];
          if (el && el.getBoundingClientRect().top <= line) current = year;
        }
        if (current) setActiveYear(current);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [years]);

  let lastYear = "";

  return (
    <>
      <PageHeader title="Timeline" description={`${rows.length} letters in chronological order`} />
      <WeekInHistory
        letters={letters}
        selected={selected}
        onToggle={toggleSelected}
        actions={selectionActions}
      />
      <MonthInHistory
        letters={letters}
        selected={selected}
        onToggle={toggleSelected}
        actions={selectionActions}
      />
      <div
        ref={barRef}
        className="sticky top-[53px] z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-8 lg:top-0"
      >
        <Input
          className="h-8 w-full sm:w-72"
          placeholder="Filter by person, place or keyword…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {selectionActions && <div className="mt-2">{selectionActions}</div>}
        {years.length > 0 && (
          <div
            className="no-scrollbar mt-2 flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Jump to year"
          >
            {years.map((y) => {
              const on = activeYear === y.year;
              return (
                <button
                  key={y.year}
                  type="button"
                  onClick={() => jumpToYear(y.year)}
                  title={`${y.count} record${y.count === 1 ? "" : "s"} in ${y.year}`}
                  aria-current={on ? "true" : undefined}
                  className={`rounded-full border px-2.5 py-0.5 text-xs tabular-nums transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {y.year}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="max-w-4xl p-4 sm:p-8">
        {rows.map((l) => {
          const year = l.normalized_date?.slice(0, 4) || "Undated";
          const showYear = year !== lastYear;
          lastYear = year;
          return (
            <div key={l.id}>
              {showYear && (
                <h2
                  id={`timeline-year-${year}`}
                  ref={(el) => {
                    headingRefs.current[year] = el;
                  }}
                  className="font-display mt-8 mb-3 border-b border-archive-rule pb-1 text-lg font-semibold first:mt-0"
                >
                  {year}
                </h2>
              )}
              <div className="border-l-2 border-border py-2 pl-4 hover:border-primary hover:bg-muted/50">
                <CollectionLabels record={{kind:'letter',id:l.id}} />
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {canEdit && (
                    <Checkbox
                      className="self-center"
                      aria-label={`Select ${l.archive_id}`}
                      checked={selected.has(l.id)}
                      onCheckedChange={(checked) => toggleSelected(l.id, checked === true)}
                    />
                  )}
                  <Link
                    to="/letters/$archiveId"
                    params={{ archiveId: l.archive_id }}
                    className="archive-id text-sm text-primary hover:underline"
                  >
                    {l.archive_id}
                  </Link>
                  <span
                    title={recordHealth(l, aiByLetter[l.id]).label}
                    aria-label={recordHealth(l, aiByLetter[l.id]).label}
                    className="inline-block h-2.5 w-2.5 shrink-0 self-center rounded-full border border-black/10 shadow-[inset_0_-1px_1px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.5)]"
                    style={{ backgroundColor: recordHealth(l, aiByLetter[l.id]).color }}
                  />
                  <span className="text-sm font-medium">
                    <DateLink date={l.normalized_date}>{displayDate(l)}</DateLink>
                  </span>
                  <Link
                    to="/letters/$archiveId"
                    params={{ archiveId: l.archive_id }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {l.author || "—"} → {l.recipient || "—"}
                    {l.origin ? ` · ${l.origin}` : ""}
                  </Link>
                </div>
                {l.summary_short && (
                  <Link
                    to="/letters/$archiveId"
                    params={{ archiveId: l.archive_id }}
                    className="mt-1 block text-sm text-muted-foreground hover:text-foreground"
                  >
                    {l.summary_short}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No letters yet.</p>}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS.green }} /> Complete — verified &amp; AI reviewed</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS.purple }} /> Verified — AI review pending</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS.blue }} /> AI transcribed — needs verifying</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS.yellow }} /> Scanned, transcription pending</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS.red }} /> No scans or problem detected</span>
        </p>
      </div>
    </>
  );
}
