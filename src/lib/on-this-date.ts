import { supabase } from "@/integrations/supabase/client";

export type DateSource = { title: string; publisher?: string | null; url?: string | null };

export type DateContext = {
  id: string;
  on_date: string;
  narrative_md: string;
  sources: DateSource[];
  model: string | null;
  reviewed: boolean;
  reviewed_at: string | null;
  manually_edited: boolean;
  regenerated_count: number;
  view_count: number;
  last_viewed_at: string | null;
  last_edited_at: string | null;
  generated_at: string;
  updated_at: string;
};

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function prettyDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shiftDay(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type DateRecord = {
  id: string;
  archive_id: string;
  title: string | null;
  record_type: string;
  subtype: string | null;
  author: string | null;
  recipient: string | null;
  origin: string | null;
  destination: string | null;
  summary_short: string | null;
  date_as_written: string | null;
  date_from_postmark: boolean;
  starred: boolean | null;
};

export type DateSourceRecord = {
  id: string;
  ds_id: string;
  title: string;
  source_type: string;
  institution: string | null;
  description: string | null;
};

export type DateEvent = {
  id: string;
  name: string;
  event_type: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

/** Everything in the archive that carries this exact historical date. */
export async function fetchArchiveOnDate(date: string) {
  const [letters, sources, events] = await Promise.all([
    supabase
      .from("letters")
      .select(
        "id, archive_id, title, record_type, subtype, author, recipient, origin, destination, summary_short, date_as_written, date_from_postmark, starred",
      )
      .eq("normalized_date", date)
      .order("fh_seq", { ascending: true }),
    supabase
      .from("digital_sources")
      .select("id, ds_id, title, source_type, institution, description")
      .eq("normalized_date", date)
      .order("ds_seq", { ascending: true }),
    supabase
      .from("events")
      .select("id, name, event_type, start_date, end_date, description")
      .lte("start_date", date)
      .or(`end_date.is.null,end_date.gte.${date}`)
      .limit(20),
  ]);
  return {
    records: (letters.data ?? []) as unknown as DateRecord[],
    sources: (sources.data ?? []) as unknown as DateSourceRecord[],
    events: (events.data ?? []) as unknown as DateEvent[],
  };
}

/** Closest dates before / after this one for which the archive holds a record. */
export async function fetchNeighborArchiveDates(date: string) {
  const pick = async (dir: "prev" | "next") => {
    const asc = dir === "next";
    const [l, s] = await Promise.all([
      supabase
        .from("letters")
        .select("normalized_date")
        .not("normalized_date", "is", null)
        [asc ? "gt" : "lt"]("normalized_date", date)
        .order("normalized_date", { ascending: asc })
        .limit(1),
      supabase
        .from("digital_sources")
        .select("normalized_date")
        .not("normalized_date", "is", null)
        [asc ? "gt" : "lt"]("normalized_date", date)
        .order("normalized_date", { ascending: asc })
        .limit(1),
    ]);
    const candidates = [l.data?.[0]?.normalized_date, s.data?.[0]?.normalized_date].filter(
      Boolean,
    ) as string[];
    if (!candidates.length) return null;
    return candidates.sort()[asc ? 0 : candidates.length - 1] ?? null;
  };
  const [prev, next] = await Promise.all([pick("prev"), pick("next")]);
  return { prev, next };
}

/** Editorial dashboard listing (admins / archivists). */
export async function fetchDateContexts(): Promise<DateContext[]> {
  const { data, error } = await supabase
    .from("date_contexts")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as DateContext[];
}
