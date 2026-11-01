import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Info, MapPin, Users, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Letter } from "@/lib/queries";
import { sharedContextRecords, type ContextRecord, type ContextMembership } from "@/lib/letter-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function RecordConnections({ records, label }: { records: ContextRecord[]; label: string }) {
  if (!records.length) return null;
  return <Popover>
    <PopoverTrigger asChild><Button variant="link" size="sm" className="h-auto justify-start whitespace-normal p-0 text-left text-xs">{label}</Button></PopoverTrigger>
    <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {records.map((record) => <Link key={record.id} to="/letters/$archiveId" params={{ archiveId: record.archive_id }} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
          <span className="archive-id">{record.archive_id}</span><span className="text-xs text-muted-foreground">{record.normalized_date ?? "Undated"}</span>
        </Link>)}
      </div>
    </PopoverContent>
  </Popover>;
}

export function LetterContextPanel({ letter }: { letter: Letter }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const context = useQuery({
    queryKey: ["links", letter.id, "reading-context"],
    queryFn: async () => {
      const [people, places] = await Promise.all([
        supabase.from("letter_people").select("id,person_id,role,people(id,name,relationship,biographical_notes)").eq("letter_id", letter.id).order("id"),
        supabase.from("letter_places").select("id,place_id,role,places(canonical_name,historical_notes)").eq("letter_id", letter.id).order("id"),
      ]);
      if (people.error) throw people.error;
      if (places.error) throw places.error;
      return { people: people.data, places: places.data };
    },
  });
  const people = context.data?.people ?? [];
  const personIds = [...new Set(people.map((p) => p.person_id))];
  const origin = letter.origin?.trim();
  const connections = useQuery({
    queryKey: ["links", letter.id, "reading-connections", personIds.join(","), origin],
    enabled: open && context.isSuccess,
    queryFn: async () => {
      const memberships: ContextMembership[] = [];
      const originRecords: ContextRecord[] = [];
      await Promise.all([
        (async () => {
          if (!personIds.length) return;
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from("letter_people").select("person_id,letter_id,letters(id,archive_id,normalized_date)").in("person_id", personIds).order("id").range(offset, offset + 499);
            if (error) throw error;
            memberships.push(...data);
            if (data.length < 500) break;
          }
        })(),
        (async () => {
          if (!origin || origin.toUpperCase() === "NONE") return;
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from("letters").select("id,archive_id,normalized_date").eq("origin", letter.origin ?? "").order("id").range(offset, offset + 499);
            if (error) throw error;
            originRecords.push(...data);
            if (data.length < 500) break;
          }
        })(),
      ]);
      return { memberships, originRecords };
    },
  });
  const mentioned = people.filter((p) => p.role !== "author" && p.role !== "recipient")
    .filter((p, index, rows) => rows.findIndex((r) => r.person_id === p.person_id) === index);
  const author = people.find((p) => p.role === "author");
  const recipient = people.find((p) => p.role === "recipient");
  const summary = [
    [author?.people?.name ?? letter.author, recipient?.people?.name ?? letter.recipient].filter(Boolean).join(" → "),
    mentioned.length ? `Mentioning: ${mentioned.map((p) => p.people?.name).filter(Boolean).join(", ")}` : "",
    letter.dateline && letter.dateline.toUpperCase() !== "NONE" ? letter.dateline : origin && origin.toUpperCase() !== "NONE" ? origin : "",
  ].filter(Boolean).join(" · ");
  function renderPerson(row: (typeof people)[number]) {
    const person = row.people;
    if (!person) return null;
    const records = sharedContextRecords(connections.data?.memberships ?? [], [row.person_id]);
    return <div key={row.id} className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link to="/people/$personId" params={{ personId: person.id }} className="font-medium text-primary hover:underline">{person.name}</Link>
        {(row.role === "author" || row.role === "recipient") && <span className="text-xs text-muted-foreground">{row.role === "author" ? "Author" : "Recipient"}</span>}
        {person.biographical_notes && <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="size-6" aria-label={`About ${person.name}`} title={`About ${person.name}`}><Info className="size-3.5" /></Button></PopoverTrigger><PopoverContent className="max-w-[calc(100vw-2rem)]"><p className="mb-2 font-medium">{person.name}</p><p className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{person.biographical_notes}</p></PopoverContent></Popover>}
      </div>
      {person.relationship && <p className="text-xs text-muted-foreground">{person.relationship}</p>}
      <RecordConnections records={records} label={`${records.length} linked ${records.length === 1 ? "letter" : "letters"}`} />
    </div>;
  }
  const shared = sharedContextRecords(connections.data?.memberships ?? [], personIds);
  return <section data-state={open ? "open" : "closed"} className="no-print mx-4 mt-4 border-y border-archive-gold/30 bg-archive-note/40 sm:mx-8">
    <Button variant="ghost" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={contentId} className="h-auto w-full justify-between gap-3 rounded-none px-3 py-3 text-left hover:bg-archive-note-hover/50" aria-label="Cast of Characters & Setting">
      <div className="min-w-0 space-y-1"><span className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4 shrink-0 text-archive-gold-strong" />Cast of Characters &amp; Setting</span><span className="block whitespace-normal break-words text-xs font-normal text-muted-foreground">{summary || "No people or places recorded yet"}</span></div>
      <ChevronDown className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
    </Button>
    <div id={contentId} hidden={!open}>
      {context.isPending ? <p className="p-4 text-sm text-muted-foreground">Loading context…</p> : context.isError ? <p className="p-4 text-sm text-destructive">Could not load recorded connections.</p> : <div className="grid gap-x-8 gap-y-5 border-t border-archive-gold/20 p-4 text-sm sm:grid-cols-2">
        <section className="min-w-0 space-y-3"><h3 className="field-label flex items-center gap-2"><Users className="size-3.5" />Correspondents</h3>
          {author ? renderPerson(author) : letter.author ? <p>{letter.author} <span className="text-xs text-muted-foreground">Author</span></p> : null}
          {recipient ? renderPerson(recipient) : letter.recipient ? <p>{letter.recipient} <span className="text-xs text-muted-foreground">Recipient</span></p> : null}
          {!author && !recipient && !letter.author && !letter.recipient && <p className="text-muted-foreground">No correspondents recorded.</p>}
        </section>
        <section className="min-w-0 space-y-3"><h3 className="field-label flex items-center gap-2"><MapPin className="size-3.5" />Setting &amp; Places</h3>
          {letter.dateline && letter.dateline.toUpperCase() !== "NONE" && <p><span className="text-xs text-muted-foreground">Written at · </span>{letter.dateline}</p>}
          {origin && origin.toUpperCase() !== "NONE" && <div><p><span className="text-xs text-muted-foreground">Mailed from · </span>{origin}</p><RecordConnections records={connections.data?.originRecords ?? []} label={`${connections.data?.originRecords.length ?? 0} letters from this mailing origin`} /></div>}
          {context.data?.places.map((row) => <div key={row.id}><Link to="/places/$placeId" params={{ placeId: row.place_id }} className="font-medium text-primary hover:underline">{row.places?.canonical_name}</Link><span className="ml-2 text-xs text-muted-foreground">{row.role}</span>{row.places?.historical_notes && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{row.places.historical_notes}</p>}</div>)}
          {!letter.dateline && !origin && !context.data?.places.length && <p className="text-muted-foreground">No setting recorded.</p>}
        </section>
        <section className="min-w-0 space-y-3"><h3 className="field-label">Named in this letter</h3>{mentioned.length ? mentioned.map(renderPerson) : <p className="text-muted-foreground">No mentioned people linked yet.</p>}</section>
        <section className="min-w-0 space-y-3"><h3 className="field-label flex items-center gap-2"><Link2 className="size-3.5" />Shared Moments</h3>
          {connections.isPending ? <p className="text-muted-foreground">Loading shared letters…</p> : connections.isError ? <p className="text-destructive">Could not load shared letters.</p> : personIds.length > 1 && shared.length ? <><p className="text-xs text-muted-foreground">{[...new Map(people.filter((p) => p.people).map((p) => [p.person_id, p.people?.name])).values()].join(", ")}</p><RecordConnections records={shared} label={`${shared.length} ${shared.length === 1 ? "letter" : "letters"} linking these people`} /></> : <p className="text-muted-foreground">No shared-letter connections recorded.</p>}
        </section>
      </div>}
    </div>
  </section>;
}