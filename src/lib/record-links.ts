import { supabase } from "@/integrations/supabase/client";
import { dsTypeLabel } from "@/lib/sources";
import { RECORD_TYPES } from "@/lib/archive";

/**
 * Universal, archive-wide cross-references.
 *
 * A link joins any two archive records — physical FH records ("letter") or
 * Digital Archive records ("source") — in any combination. Each connection is
 * stored once with a canonical ordering (enforced by a database trigger) and
 * read from either side, so relationships are always bidirectional.
 *
 * Cross-references are intellectual/historical only: they never touch
 * container, enclosure, provenance or storage information on either record.
 */
export type RecordKind = "letter" | "source";

export type ArchiveRecordRef = {
  kind: RecordKind;
  id: string;
  ref: string;
  title: string;
  date_text: string;
  sort_date: string | null;
  type_label: string;
  collection: string;
};

export type RecordLink = {
  id: string;
  note: string | null;
  created_at: string;
  /** The record on the other side of the connection. */
  other: ArchiveRecordRef;
};

export function collectionLabel(kind: RecordKind) {
  return kind === "letter" ? "Physical Archive" : "Digital Archive";
}

export function typeLabelFor(kind: RecordKind, raw: string) {
  if (!raw) return "";
  if (kind === "source") return dsTypeLabel(raw);
  const known = RECORD_TYPES.find((t) => t.value === raw);
  if (known) return known.label;
  return raw.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Archive-wide search across FH records and Digital Archive records. */
export async function searchArchiveRecords(q: string, limit = 25): Promise<ArchiveRecordRef[]> {
  const { data, error } = await supabase.rpc("search_archive_records", {
    p_q: q || null,
    p_limit: limit,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as ArchiveRecordRef[];
}

type LinkRow = {
  id: string;
  note: string | null;
  created_at: string;
  a_kind: RecordKind;
  a_id: string;
  b_kind: RecordKind;
  b_id: string;
};

/** Every record connected to (kind, id), read from both sides of the link. */
export async function fetchRelatedRecords(kind: RecordKind, id: string): Promise<RecordLink[]> {
  const { data, error } = await supabase
    .from("record_links")
    .select("id, note, created_at, a_kind, a_id, b_kind, b_id")
    .or(`a_id.eq.${id},b_id.eq.${id}`);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as LinkRow[]).filter(
    (r) => (r.a_kind === kind && r.a_id === id) || (r.b_kind === kind && r.b_id === id),
  );
  if (!rows.length) return [];

  const others = rows.map((r) =>
    r.a_kind === kind && r.a_id === id
      ? { kind: r.b_kind, id: r.b_id }
      : { kind: r.a_kind, id: r.a_id },
  );
  const letterIds = others.filter((o) => o.kind === "letter").map((o) => o.id);
  const sourceIds = others.filter((o) => o.kind === "source").map((o) => o.id);

  const [letters, sources] = await Promise.all([
    letterIds.length
      ? supabase
          .from("letters")
          .select(
            "id, archive_id, title, author, recipient, date_as_written, normalized_date, sort_date, record_type, subtype",
          )
          .in("id", letterIds)
      : Promise.resolve({ data: [] as never[] }),
    sourceIds.length
      ? supabase
          .from("digital_sources")
          .select(
            "id, ds_id, title, original_date, normalized_date, historical_date_range, source_type",
          )
          .in("id", sourceIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const byId = new Map<string, ArchiveRecordRef>();
  for (const l of (letters.data ?? []) as Array<Record<string, string | null>>) {
    byId.set(String(l.id), {
      kind: "letter",
      id: String(l.id),
      ref: String(l.archive_id ?? ""),
      title:
        l.title ||
        [l.author, l.recipient ? `to ${l.recipient}` : ""].filter(Boolean).join(" ") ||
        String(l.archive_id ?? ""),
      date_text: l.date_as_written || l.normalized_date || "",
      sort_date: l.sort_date || l.normalized_date || null,
      type_label: typeLabelFor("letter", l.subtype || l.record_type || ""),
      collection: "Physical Archive",
    });
  }
  for (const s of (sources.data ?? []) as Array<Record<string, string | null>>) {
    byId.set(String(s.id), {
      kind: "source",
      id: String(s.id),
      ref: String(s.ds_id ?? ""),
      title: s.title || String(s.ds_id ?? ""),
      date_text: s.original_date || s.normalized_date || s.historical_date_range || "",
      sort_date: s.normalized_date || null,
      type_label: typeLabelFor("source", s.source_type || ""),
      collection: "Digital Archive",
    });
  }

  return rows
    .map((r) => {
      const o = r.a_kind === kind && r.a_id === id ? r.b_id : r.a_id;
      const other = byId.get(o);
      return other ? { id: r.id, note: r.note, created_at: r.created_at, other } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a as RecordLink).other.ref.localeCompare((b as RecordLink).other.ref)) as RecordLink[];
}

export async function addRecordLink(
  from: { kind: RecordKind; id: string },
  to: { kind: RecordKind; id: string },
  note?: string,
) {
  const { error } = await supabase.from("record_links").insert({
    a_kind: from.kind,
    a_id: from.id,
    b_kind: to.kind,
    b_id: to.id,
    note: note?.trim() || null,
  } as never);
  if (error) {
    if (error.code === "23505") throw new Error("Those records are already connected");
    throw error;
  }
}

export async function updateRecordLinkNote(linkId: string, note: string) {
  const { error } = await supabase
    .from("record_links")
    .update({ note: note.trim() || null } as never)
    .eq("id", linkId);
  if (error) throw error;
}

export async function removeRecordLink(linkId: string) {
  const { error } = await supabase.from("record_links").delete().eq("id", linkId);
  if (error) throw error;
}

/** First available thumbnail for a record, or "" when it has no images. */
export async function recordThumbnailUrl(kind: RecordKind, id: string): Promise<string> {
  if (kind === "letter") {
    const { data } = await supabase
      .from("file_derivatives")
      .select("storage_path")
      .eq("letter_id", id)
      .eq("kind", "thumbnail")
      .eq("status", "complete")
      .limit(1);
    const path = data?.[0]?.storage_path;
    if (!path) return "";
    const signed = await supabase.storage.from("scans").createSignedUrl(path, 3600);
    return signed.data?.signedUrl ?? "";
  }
  const { data } = await supabase
    .from("ds_files")
    .select("storage_path")
    .eq("source_id", id)
    .eq("file_type", "image")
    .order("sort_order", { ascending: true })
    .limit(1);
  const path = data?.[0]?.storage_path;
  if (!path) return "";
  const signed = await supabase.storage.from("ds-files").createSignedUrl(path, 3600);
  return signed.data?.signedUrl ?? "";
}
