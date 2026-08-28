import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { fetchLetters } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  PERIODS,
  RECORD_RESEARCH_STATUS,
  RECORD_TYPES,
  REVIEW_STATUS,
  SCAN_STATUS,
  TRANSCRIPTION_STATUS,
  displayDate,
  subtypesFor,
} from "@/lib/archive";


export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Harrington Letter Archive" },
      {
        name: "description",
        content:
          "Search letter metadata, transcriptions, keywords, people, places, summaries and research notes.",
      },
      { property: "og:title", content: "Search — Harrington Letter Archive" },
      {
        property: "og:description",
        content: "Full-collection search across metadata, transcriptions and research notes.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <SearchPage />
    </AppShell>
  ),
});

function SearchPage() {
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const { data: index } = useQuery({
    queryKey: ["search_index"],
    queryFn: async () => {
      const [k, p, pl, refs, o, ev] = await Promise.all([
        supabase.from("letter_keywords").select("letter_id, keywords(name)"),
        supabase.from("letter_people").select("letter_id, people(name)"),
        supabase.from("letter_places").select("letter_id, places(canonical_name)"),
        supabase.from("historical_references").select("letter_id, reference, notes, description"),
        supabase.from("letter_organizations").select("letter_id, organizations(name)"),
        supabase.from("letter_events").select("letter_id, events(name)"),
      ]);
      const map: Record<string, string[]> = {};
      const push = (id: string, v?: string | null) => v && (map[id] ??= []).push(v);
      (k.data ?? []).forEach((r) => push(r.letter_id, r.keywords?.name));
      (p.data ?? []).forEach((r) => push(r.letter_id, r.people?.name));
      (pl.data ?? []).forEach((r) => push(r.letter_id, r.places?.canonical_name));
      (o.data ?? []).forEach((r) => push(r.letter_id, r.organizations?.name));
      (ev.data ?? []).forEach((r) => push(r.letter_id, r.events?.name));
      (refs.data ?? []).forEach((r) => {
        push(r.letter_id, r.reference);
        push(r.letter_id, r.notes);
        push(r.letter_id, r.description);
      });
      return map;
    },
  });

  const { data: linkSets } = useQuery({
    queryKey: ["search_link_sets"],
    queryFn: async () => {
      const [p, o, ev] = await Promise.all([
        supabase.from("letter_people").select("letter_id, person_id"),
        supabase.from("letter_organizations").select("letter_id, organization_id"),
        supabase.from("letter_events").select("letter_id, event_id"),
      ]);
      return {
        people: p.data ?? [],
        orgs: o.data ?? [],
        events: ev.data ?? [],
      };
    },
  });

  const { data: entities } = useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const [p, pl, k, o, ev] = await Promise.all([
        supabase.from("people").select("id,name").order("name"),
        supabase.from("places").select("id,canonical_name").order("canonical_name"),
        supabase.from("keywords").select("id,name").order("name"),
        supabase.from("organizations").select("id,name").order("name"),
        supabase.from("events").select("id,name").order("name"),
      ]);
      return {
        people: p.data ?? [],
        places: pl.data ?? [],
        keywords: k.data ?? [],
        organizations: o.data ?? [],
        events: ev.data ?? [],
      };
    },
  });

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [author, setAuthor] = useState("");
  const [recipient, setRecipient] = useState("");
  const [period, setPeriod] = useState("");
  const [place, setPlace] = useState("");
  const [tstat, setTstat] = useState("");
  const [sstat, setSstat] = useState("");
  const [rstat, setRstat] = useState("");
  const [rtype, setRtype] = useState("");
  const [subtype, setSubtype] = useState("");
  const [research, setResearch] = useState("");
  const [personId, setPersonId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [eventId, setEventId] = useState("");


  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return letters.filter((l) => {
      if (from && (!l.normalized_date || l.normalized_date < from)) return false;
      if (to && (!l.normalized_date || l.normalized_date > to)) return false;
      if (author && !(l.author ?? "").toLowerCase().includes(author.toLowerCase())) return false;
      if (recipient && !(l.recipient ?? "").toLowerCase().includes(recipient.toLowerCase()))
        return false;
      if (period && l.period !== period) return false;
      if (place && !`${l.origin ?? ""} ${l.destination ?? ""}`.toLowerCase().includes(place.toLowerCase()))
        return false;
      if (tstat && l.transcription_status !== tstat) return false;
      if (sstat && l.scan_status !== sstat) return false;
      if (rstat && l.review_status !== rstat) return false;
      if (rtype && (l.record_type ?? "letter") !== rtype) return false;
      if (subtype && (l.subtype ?? "") !== subtype) return false;
      if (research && (l.research_status ?? "unreviewed") !== research) return false;
      if (
        personId &&
        !(linkSets?.people ?? []).some((r) => r.letter_id === l.id && r.person_id === personId)
      )
        return false;
      if (
        orgId &&
        !(linkSets?.orgs ?? []).some((r) => r.letter_id === l.id && r.organization_id === orgId)
      )
        return false;
      if (
        eventId &&
        !(linkSets?.events ?? []).some((r) => r.letter_id === l.id && r.event_id === eventId)
      )
        return false;
      if (!term) return true;
      const hay = [
        l.archive_id,
        l.title,
        l.subtype,
        l.primary_person,
        l.author,
        l.recipient,
        l.origin,
        l.destination,
        l.date_as_written,
        l.notes,
        l.summary_short,
        l.summary_long,
        l.transcription_verified,
        l.transcription_raw_ai,
        l.physical_condition,
        l.physical_description,
        l.historical_notes,
        l.research_notes,
        l.ocr_text,
        ...((index ?? {})[l.id] ?? []),
      ]
        .join(" \n ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [
    letters,
    q,
    from,
    to,
    author,
    recipient,
    period,
    place,
    tstat,
    sstat,
    rstat,
    rtype,
    subtype,
    research,
    personId,
    orgId,
    eventId,
    linkSets,
    index,
  ]);


  function snippet(text: string | null) {
    if (!text || !q) return null;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return null;
    return "…" + text.slice(Math.max(0, i - 60), i + 100).trim() + "…";
  }

  return (
    <>
      <PageHeader title="Search" description={`${results.length} matching letters`} />
      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-8 p-4 sm:p-8">
        <aside className="space-y-3">
          <div>
            <label className="field-label">Date from</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
          </div>
          <div>
            <label className="field-label">Date to</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
          </div>
          <div>
            <label className="field-label">Author</label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} className="h-8" />
          </div>
          <div>
            <label className="field-label">Recipient</label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="h-8" />
          </div>
          <div>
            <label className="field-label">Location</label>
            <Input value={place} onChange={(e) => setPlace(e.target.value)} className="h-8" />
          </div>
          <div>
            <label className="field-label">Record type</label>
            <select
              className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
              value={rtype}
              onChange={(e) => {
                setRtype(e.target.value);
                setSubtype("");
              }}
            >
              <option value="">Any</option>
              {RECORD_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {rtype && (
            <div>
              <label className="field-label">Subtype</label>
              <select
                className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
              >
                <option value="">Any</option>
                {subtypesFor(rtype).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {[
            { label: "Person", v: personId, set: setPersonId, opts: (entities?.people ?? []).map((p) => ({ value: p.id, label: p.name })) },
            {
              label: "Organization / ship",
              v: orgId,
              set: setOrgId,
              opts: (entities?.organizations ?? []).map((o) => ({ value: o.id, label: o.name })),
            },
            {
              label: "Event",
              v: eventId,
              set: setEventId,
              opts: (entities?.events ?? []).map((e) => ({ value: e.id, label: e.name })),
            },
            { label: "Research status", v: research, set: setResearch, opts: RECORD_RESEARCH_STATUS },
            { label: "Period", v: period, set: setPeriod, opts: PERIODS },
            { label: "Transcription", v: tstat, set: setTstat, opts: TRANSCRIPTION_STATUS },
            { label: "Scan status", v: sstat, set: setSstat, opts: SCAN_STATUS },
            { label: "Review status", v: rstat, set: setRstat, opts: REVIEW_STATUS },

          ].map((f) => (
            <div key={f.label}>
              <label className="field-label">{f.label}</label>
              <select
                className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                value={f.v}
                onChange={(e) => f.set(e.target.value)}
              >
                <option value="">Any</option>
                {f.opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </aside>

        <div>
          <Input
            autoFocus
            className="h-11 text-base"
            placeholder='Search everything — e.g. "London"'
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-4 divide-y divide-border rounded border border-border bg-card">
            {results.map((l) => (
              <Link
                key={l.id}
                to="/letters/$archiveId"
                params={{ archiveId: l.archive_id }}
                className="block px-4 py-3 hover:bg-muted/60"
              >
                <div className="flex items-baseline gap-4 text-sm">
                  <span className="archive-id text-primary">{l.archive_id}</span>
                  <span>{displayDate(l)}</span>
                  <span className="text-muted-foreground">
                    {l.author || "—"} → {l.recipient || "—"}
                  </span>
                  <span className="ml-auto text-muted-foreground">{l.origin}</span>
                </div>
                {(snippet(l.transcription_verified) ||
                  snippet(l.summary_short) ||
                  snippet(l.notes)) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {snippet(l.transcription_verified) ||
                      snippet(l.summary_short) ||
                      snippet(l.notes)}
                  </p>
                )}
              </Link>
            ))}
            {results.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">No matches.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
