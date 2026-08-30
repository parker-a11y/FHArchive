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

export const Route = createFileRoute("/search")({
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

  function snippet(l: Letter): string {
    const text = (l.transcription_verified ?? "").replace(/\s+/g, " ");
    if (!debouncedQ) return text.slice(0, 140);
    const i = text.toLowerCase().indexOf(debouncedQ.toLowerCase());
    if (i < 0) return (l.summary_short ?? text).slice(0, 140);
    return "…" + text.slice(Math.max(0, i - 40), i + 100) + "…";
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
            {results.map((l) => (
              <div key={l.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <Link
                    to="/letters/$archiveId"
                    params={{ archiveId: l.archive_id }}
                    className="archive-id text-primary hover:underline"
                  >
                    {l.archive_id}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {displayDate(l)} · {labelOf(PERIODS, l.period)} · {labelOf(recordTypeOptions, l.record_type)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">
                  {[l.author, l.recipient].filter(Boolean).join(" → ") || l.title || "Untitled"}
                </p>
                {snippet(l) && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{snippet(l)}</p>
                )}
              </div>
            ))}
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
