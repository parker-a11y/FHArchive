import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ToneMultiSelect } from "@/components/ToneMultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchLetters, type Letter } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  PERIODS,
  RECORD_RESEARCH_STATUS,
  REVIEW_STATUS,
  TRANSCRIPTION_STATUS,
  displayDate,
  labelOf,
} from "@/lib/archive";
import { useRecordTypeOptions } from "@/lib/categories";
import { HighlightedText, buildSnippets, countMatches, type Snippet } from "@/lib/highlight";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Search — The Francis Files" },
      {
        name: "description",
        content:
          "Full-text search across letter metadata, transcriptions, people, places, keywords and historical references.",
      },
      { property: "og:title", content: "Search — The Francis Files" },
      { property: "og:description", content: "Search every letter and reference in the archive." },
    ],
  }),
  component: () => (
    <AppShell>
      <SearchPage />
    </AppShell>
  ),
});

const SEARCH_LIMIT = 200;
const SNIPPETS_SHOWN = 3;

/** One search result: header, hit count, highlighted snippets, jump-to-match links. */
function ResultCard({
  letter,
  term,
  snippets,
  tags,
  hits,
  meta,
}: {
  letter: Letter;
  term: string;
  snippets: Snippet[];
  tags: string[];
  hits: number;
  meta: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? snippets : snippets.slice(0, SNIPPETS_SHOWN);
  const jump = {
    to: "/letters/$archiveId" as const,
    params: { archiveId: letter.archive_id },
    search: term ? { hl: term, tab: "transcription" } : {},
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <Link {...jump} className="archive-id text-primary hover:underline">
            {letter.archive_id}
          </Link>
          {hits > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {hits} match{hits === 1 ? "" : "es"}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
      <p className="mt-1 text-sm font-medium">
        {[letter.author, letter.recipient].filter(Boolean).join(" → ") || letter.title || "Untitled"}
      </p>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="rounded border border-border px-1.5 py-0.5 text-[11px]">
              <HighlightedText text={t} term={term} />
            </span>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {shown.map((s, i) => (
            <Link
              key={`${s.label}-${i}`}
              {...jump}
              className="block rounded border border-transparent bg-muted/40 p-2 text-sm hover:border-border"
            >
              <span className="mr-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                {s.label}
              </span>
              <span className="text-muted-foreground">
                <HighlightedText text={expanded ? s.full : s.text} term={term} />
              </span>
            </Link>
          ))}
        </div>
      )}

      {(snippets.length > 0 || snippets.length > SNIPPETS_SHOWN) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {snippets.length > SNIPPETS_SHOWN && (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show fewer matches" : `+${snippets.length - SNIPPETS_SHOWN} more matches`}
            </button>
          )}
          {snippets.length > 0 && (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide full context" : "Show full context"}
            </button>
          )}
          <Link {...jump} className="text-primary hover:underline">
            Open at match →
          </Link>
        </div>
      )}
    </div>
  );
}

/** Debounce the main text box so typing doesn't fire a query per keystroke. */
function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function SearchPage() {
  const recordTypeOptions = useRecordTypeOptions();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [author, setAuthor] = useState("");
  const [recipient, setRecipient] = useState("");
  const [place, setPlace] = useState("");
  const [tones, setTones] = useState<string[]>([]);
  const [rType, setRType] = useState("");
  const [subtype, setSubtype] = useState("");
  const [person, setPerson] = useState("");
  const [org, setOrg] = useState("");
  const [event, setEvent] = useState("");
  const [research, setResearch] = useState("");
  const [tStatus, setTStatus] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [rStatus, setRStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasAny = Boolean(
    debouncedQ ||
      author ||
      recipient ||
      place ||
      tones.length ||
      rType ||
      subtype ||
      person ||
      org ||
      event ||
      research ||
      tStatus ||
      scanStatus ||
      rStatus ||
      dateFrom ||
      dateTo,
  );

  // Small dropdown datasets only — the matching itself runs in the database.
  const { data: entities } = useQuery({
    queryKey: ["search_entities"],
    queryFn: async () => {
      const [p, o, e] = await Promise.all([
        supabase.from("people").select("id,name").order("name"),
        supabase.from("organizations").select("id,name").order("name"),
        supabase.from("events").select("id,name").order("name"),
      ]);
      return {
        people: p.data ?? [],
        orgs: o.data ?? [],
        events: e.data ?? [],
      };
    },
  });

  const { data: page, isFetching } = useQuery({
    queryKey: [
      "search",
      {
        q: debouncedQ, author, recipient, place, tones, rType, subtype,
        person, org, event, research, tStatus, scanStatus, rStatus, dateFrom, dateTo,
      },
    ],
    enabled: hasAny,
    placeholderData: keepPreviousData,
    queryFn: () =>
      searchLetters({
        q: debouncedQ,
        type: rType,
        subtype,
        tstatus: tStatus,
        review: rStatus,
        scan: scanStatus as "" | "has" | "none",
        tones,
        research,
        personId: person || undefined,
        orgId: org || undefined,
        eventId: event || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        author,
        recipient,
        place,
        sort: "fh_seq",
        dir: "asc",
        limit: SEARCH_LIMIT,
      }),
  });
  const results: Letter[] = page?.rows ?? [];
  const totalMatches = page?.total ?? 0;
  const resultIds = results.map((l) => l.id);

  // Page-level scan transcriptions + linked entity names for the visible results,
  // so a hit can be labelled with its page number or the keyword/person/place it came from.
  const { data: context } = useQuery({
    queryKey: ["search_context", debouncedQ, resultIds],
    enabled: Boolean(debouncedQ) && resultIds.length > 0,
    queryFn: async () => {
      const like = `%${debouncedQ}%`;
      const [pages, kw, ppl, plc] = await Promise.all([
        supabase
          .from("scan_transcriptions")
          .select("letter_id,page_label,page_index,ai_text,verified_text")
          .in("letter_id", resultIds)
          .or(`verified_text.ilike.${like},ai_text.ilike.${like}`),
        supabase
          .from("letter_keywords")
          .select("letter_id,keywords(name)")
          .in("letter_id", resultIds),
        supabase.from("letter_people").select("letter_id,people(name)").in("letter_id", resultIds),
        supabase
          .from("letter_places")
          .select("letter_id,places(canonical_name)")
          .in("letter_id", resultIds),
      ]);
      const byId = new Map<string, { snippets: Snippet[]; tags: string[] }>();
      const bucket = (id: string) => {
        let b = byId.get(id);
        if (!b) {
          b = { snippets: [], tags: [] };
          byId.set(id, b);
        }
        return b;
      };
      for (const p of pages.data ?? []) {
        const label = p.page_label || `Page ${(p.page_index ?? 0) + 1}`;
        const text = p.verified_text || p.ai_text;
        bucket(p.letter_id).snippets.push(...buildSnippets(label, text, debouncedQ, 2));
      }
      const term = debouncedQ.toLowerCase();
      const addTag = (id: string, kind: string, name?: string | null) => {
        if (name && name.toLowerCase().includes(term)) bucket(id).tags.push(`${kind}: ${name}`);
      };
      for (const r of kw.data ?? [])
        addTag(r.letter_id, "Keyword", (r as { keywords: { name: string } | null }).keywords?.name);
      for (const r of ppl.data ?? [])
        addTag(r.letter_id, "Person", (r as { people: { name: string } | null }).people?.name);
      for (const r of plc.data ?? [])
        addTag(
          r.letter_id,
          "Place",
          (r as { places: { canonical_name: string } | null }).places?.canonical_name,
        );
      return byId;
    },
  });

  function matchesFor(l: Letter): { snippets: Snippet[]; tags: string[] } {
    if (!debouncedQ) {
      const text = (l.transcription_verified ?? l.summary_short ?? "").replace(/\s+/g, " ");
      return text
        ? { snippets: [{ label: "Summary", text: text.slice(0, 160), full: text.slice(0, 900) }], tags: [] }
        : { snippets: [], tags: [] };
    }
    const extra = context?.get(l.id);
    const snippets = [
      ...buildSnippets("Verified transcription", l.transcription_verified, debouncedQ),
      ...(extra?.snippets ?? []),
      ...buildSnippets("AI transcription", l.transcription_raw_ai, debouncedQ),
      ...buildSnippets("Summary", l.summary_short, debouncedQ, 1),
      ...buildSnippets("Summary", l.summary_long, debouncedQ, 1),
      ...buildSnippets("Notes", l.notes, debouncedQ, 2),
      ...buildSnippets("Research notes", l.research_notes, debouncedQ, 1),
      ...buildSnippets("Historical notes", l.historical_notes, debouncedQ, 1),
      ...buildSnippets("Title", l.title, debouncedQ, 1),
    ];
    return { snippets, tags: extra?.tags ?? [] };
  }

  function hitCount(l: Letter): number {
    if (!debouncedQ) return 0;
    return (
      countMatches(l.transcription_verified, debouncedQ) +
      countMatches(l.transcription_raw_ai, debouncedQ) +
      countMatches(l.notes, debouncedQ) +
      countMatches(l.summary_short, debouncedQ) +
      countMatches(l.summary_long, debouncedQ) +
      countMatches(l.title, debouncedQ)
    );
  }


  const sel =
    "h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <>
      <PageHeader
        title="Search"
        description="Search across metadata, transcriptions, people, places, keywords and historical references."
      />
      <div className="border-b border-border px-4 sm:px-8 py-5 space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Text, names, places, references…"
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Input placeholder="From (author)" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <Input placeholder="To (recipient)" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          <Input placeholder="Place (origin/destination)" value={place} onChange={(e) => setPlace(e.target.value)} />
          <ToneMultiSelect value={tones} onChange={setTones} placeholder="Tone / sentiment" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select className={sel} value={rType} onChange={(e) => setRType(e.target.value)}>
            <option value="">All record types</option>
            {recordTypeOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <Input placeholder="Subtype" value={subtype} onChange={(e) => setSubtype(e.target.value)} />
          <select className={sel} value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Any person</option>
            {(entities?.people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className={sel} value={org} onChange={(e) => setOrg(e.target.value)}>
            <option value="">Any organization</option>
            {(entities?.orgs ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select className={sel} value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">Any event</option>
            {(entities?.events ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <select className={sel} value={research} onChange={(e) => setResearch(e.target.value)}>
            <option value="">Any research status</option>
            {RECORD_RESEARCH_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select className={sel} value={tStatus} onChange={(e) => setTStatus(e.target.value)}>
            <option value="">Any transcription status</option>
            {TRANSCRIPTION_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select className={sel} value={scanStatus} onChange={(e) => setScanStatus(e.target.value)}>
            <option value="">Any scan status</option>
            <option value="has">Has scans</option>
            <option value="none">No scans</option>
          </select>
          <select className={sel} value={rStatus} onChange={(e) => setRStatus(e.target.value)}>
            <option value="">Any review status</option>
            {REVIEW_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="px-4 sm:px-8 py-5 space-y-3">
        {!hasAny && (
          <p className="text-sm text-muted-foreground">
            Enter a query or set a filter to search the archive.
          </p>
        )}
        {hasAny && isFetching && results.length === 0 && (
          <p className="text-sm text-muted-foreground">Searching…</p>
        )}
        {hasAny && !isFetching && results.length === 0 && (
          <p className="text-sm text-muted-foreground">No matching records.</p>
        )}
        {results.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">
              {totalMatches} match{totalMatches === 1 ? "" : "es"}
              {totalMatches > results.length ? ` — showing first ${results.length}` : ""}
            </p>
            {results.map((l) => {
              const { snippets, tags } = matchesFor(l);
              return (
                <ResultCard
                  key={l.id}
                  letter={l}
                  term={debouncedQ}
                  snippets={snippets}
                  tags={tags}
                  hits={hitCount(l)}
                  meta={`${displayDate(l)} · ${labelOf(PERIODS, l.period)} · ${labelOf(recordTypeOptions, l.record_type)}`}
                />
              );
            })}
          </>
        )}
      </div>
      {hasAny && results.length > 0 && (
        <div className="px-4 sm:px-8 pb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQ("");
              setAuthor("");
              setRecipient("");
              setPlace("");
              setTones([]);
              setRType("");
              setSubtype("");
              setPerson("");
              setOrg("");
              setEvent("");
              setResearch("");
              setTStatus("");
              setScanStatus("");
              setRStatus("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear search
          </Button>
        </div>
      )}
    </>
  );
}
