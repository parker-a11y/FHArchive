import { supabase } from "@/integrations/supabase/client";

export type Letter = {
  id: string;
  fh_seq: number;
  archive_id: string;
  date_as_written: string | null;
  normalized_date: string | null;
  date_precision: string;
  date_certainty: string;
  author: string | null;
  recipient: string | null;
  origin: string | null;
  destination: string | null;
  period: string;
  sheets: number | null;
  image_count: number;
  has_envelope: boolean;
  has_enclosures: boolean;
  physical_condition: string | null;
  notes: string | null;
  transcription_raw_ai: string | null;
  transcription_verified: string | null;
  transcription_status: string;
  scan_status: string;
  review_status: string;
  research_needed: boolean;
  summary_short: string | null;
  summary_long: string | null;
  publication_status: string;
  record_type: string;
  subtype: string | null;
  title: string | null;
  date_end: string | null;
  primary_person: string | null;
  tones: string[] | null;
  starred?: boolean | null;
  physical_description: string | null;
  original_copy: string;
  storage_location: string | null;
  storage_type: string | null;
  
  storage_folder: string | null;
  storage_position: string | null;
  storage_notes: string | null;
  identification_status: string;
  sort_date: string | null;
  digitization_status: string;
  expected_scan_count: number | null;
  completeness_check: boolean;
  scan_both_sides: boolean;
  photo_front_scanned: boolean;
  photo_back_scanned: boolean;
  digitization_override: boolean;
  digitization_completed_at: string | null;
  provenance: string | null;
  source_container_id: string | null;
  original_order_notes: string | null;
  ocr_text: string | null;
  digitization_notes: string | null;
  research_status: string;
  research_notes: string | null;
  citations: string | null;
  historical_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewRecordInput = {
  p_record_type: string;
  p_subtype?: string | null;
  p_title?: string | null;
  p_date_as_written?: string | null;
  p_normalized_date?: string | null;
  p_date_end?: string | null;
  p_date_precision: string;
  p_date_certainty: string;
  p_primary_person?: string | null;
  p_author?: string | null;
  p_recipient?: string | null;
  p_origin?: string | null;
  p_destination?: string | null;
  p_period: string;
  p_sheets?: number | null;
  p_has_envelope: boolean;
  p_has_enclosures: boolean;
  p_storage_location?: string | null;
  p_original_copy: string;
  p_notes?: string | null;
};

export async function createRecord(
  input: NewRecordInput,
): Promise<{ id: string; fh_seq: number; archive_id: string }> {
  const payload = {
    p_record_type: input.p_record_type,
    p_subtype: input.p_subtype || null,
    p_title: input.p_title || null,
    p_date_as_written: input.p_date_as_written || null,
    p_normalized_date: input.p_normalized_date || null,
    p_date_end: input.p_date_end || null,
    p_date_precision: input.p_date_precision,
    p_date_certainty: input.p_date_certainty,
    p_primary_person: input.p_primary_person || null,
    p_author: input.p_author || null,
    p_recipient: input.p_recipient || null,
    p_origin: input.p_origin || null,
    p_destination: input.p_destination || null,
    p_period: input.p_period,
    p_sheets: input.p_sheets ?? null,
    p_has_envelope: input.p_has_envelope,
    p_has_enclosures: input.p_has_enclosures,
    p_storage_location: input.p_storage_location || null,
    p_original_copy: input.p_original_copy,
    p_notes: input.p_notes || null,
  };
  const { data, error } = await supabase.rpc("create_record", payload as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { id: string; fh_seq: number; archive_id: string };
}


/**
 * List-page column set: every field used by tables, pickers and navigation,
 * excluding heavy text blobs (full transcriptions, OCR text, long summaries)
 * that made whole-table fetches multi-megabyte at scale.
 */
const LETTER_LIST_COLS =
  "id, fh_seq, archive_id, date_as_written, normalized_date, date_end, date_precision, date_certainty, author, recipient, origin, destination, period, sheets, image_count, has_envelope, has_enclosures, physical_condition, notes, transcription_status, scan_status, review_status, research_needed, summary_short, publication_status, record_type, subtype, title, primary_person, tones, physical_description, original_copy, storage_location, storage_type, storage_folder, storage_position, storage_notes, identification_status, sort_date, digitization_status, expected_scan_count, completeness_check, scan_both_sides, photo_front_scanned, photo_back_scanned, digitization_override, digitization_completed_at, provenance, source_container_id, original_order_notes, digitization_notes, research_status, citations, visibility, starred, created_at, updated_at";

/** Slim whole-list fetch for pickers/navigation. Prefer searchLetters for tables. */
export async function fetchLetters(): Promise<Letter[]> {
  const { data, error } = await supabase
    .from("letters")
    .select(LETTER_LIST_COLS)
    .order("fh_seq", { ascending: true })
    .limit(100000);
  if (error) throw error;
  return (data ?? []) as unknown as Letter[];
}

export type LetterSearchParams = {
  q?: string;
  type?: string;
  subtype?: string;
  period?: string;
  tstatus?: string; // supports "!value" negation
  review?: string;
  scan?: "" | "has" | "none";
  uncertain?: boolean;
  idStatus?: string;
  datePrecision?: string;
  digStatus?: string;
  tones?: string[];
  view?: "" | "undated" | "unidphoto";
  research?: string;
  personId?: string;
  orgId?: string;
  eventId?: string;
  dateFrom?: string;
  dateTo?: string;
  author?: string;
  recipient?: string;
  place?: string;
  starred?: boolean;
  sort?: string;
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export type LetterPage = { rows: Letter[]; total: number };

/** Server-side filtered/sorted/paginated record search (see search_letters RPC). */
export async function searchLetters(p: LetterSearchParams): Promise<LetterPage> {
  const { data, error } = await supabase.rpc("search_letters", {
    p_q: p.q || null,
    p_type: p.type || null,
    p_subtype: p.subtype || null,
    p_period: p.period || null,
    p_tstatus: p.tstatus || null,
    p_review: p.review || null,
    p_scan: p.scan || null,
    p_uncertain: p.uncertain ?? false,
    p_id_status: p.idStatus || null,
    p_date_precision: p.datePrecision || null,
    p_dig_status: p.digStatus || null,
    p_tones: p.tones?.length ? p.tones : null,
    p_view: p.view || null,
    p_research: p.research || null,
    p_person: p.personId || null,
    p_org: p.orgId || null,
    p_event: p.eventId || null,
    p_date_from: p.dateFrom || null,
    p_date_to: p.dateTo || null,
    p_author: p.author || null,
    p_recipient: p.recipient || null,
    p_place: p.place || null,
    p_starred: p.starred ?? false,
    p_sort: p.sort ?? "fh_seq",
    p_dir: p.dir ?? "asc",
    p_limit: p.limit ?? 100,
    p_offset: p.offset ?? 0,
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { total_count: number; letter: Letter }[];
  return { rows: rows.map((r) => r.letter), total: Number(rows[0]?.total_count ?? 0) };
}

/** Every record matching the given filters (for CSV/Excel export), paged 500 at a time. */
export async function fetchAllMatchingLetters(p: LetterSearchParams): Promise<Letter[]> {
  const out: Letter[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await searchLetters({ ...p, limit: 500, offset, sort: p.sort ?? "fh_seq" });
    out.push(...page.rows);
    if (out.length >= page.total || page.rows.length === 0) break;
  }
  return out;
}

export type DashboardStats = {
  total_records: number;
  by_type: Record<string, number>;
  by_period: Record<string, number>;
  transcribed: number;
  needs_transcription: number;
  uncertain_dates: number;
  total_scans: number;
  letters_with_files: number;
  starred_records: number;
  starred_sources: number;
};

/** All dashboard counts in one database call. */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("dashboard_stats");
  if (error) throw error;
  return data as unknown as DashboardStats;
}

export type ArchiveItemCounts = {
  totalItems: number;
  itemsScanned: number;
  totalScans: number;
};

/** Aggregate counts across digitized files (whole archive). */
export async function fetchItemCounts(): Promise<ArchiveItemCounts> {
  const stats = await fetchDashboardStats();
  return {
    totalItems: stats.total_scans,
    itemsScanned: stats.letters_with_files,
    totalScans: stats.total_scans,
  };
}

export async function fetchLetterByArchiveId(archiveId: string): Promise<Letter | null> {
  const { data, error } = await supabase
    .from("letters")
    .select("*")
    .eq("archive_id", archiveId)
    .maybeSingle();
  if (error) throw error;
  return (data as Letter) ?? null;
}

export async function previewNextArchiveId(): Promise<{ fh_seq: number; archive_id: string }> {
  const { data, error } = await supabase.rpc("preview_next_archive_id");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { fh_seq: number; archive_id: string };
}





/**
 * Permanently deletes a letter (and, via cascade, its scans/links/history).
 * If it was the most recently issued FH number, the counter is rolled back so
 * the number is reused by the next record.
 */
export async function deleteLetter(letter: Pick<Letter, "id" | "fh_seq">): Promise<boolean> {
  const [masters, derivatives] = await Promise.all([
    supabase.from("digital_files").select("master_path").eq("letter_id", letter.id),
    supabase.from("file_derivatives").select("storage_path").eq("letter_id", letter.id),
  ]);
  const paths = [
    ...(masters.data ?? []).map((f) => f.master_path),
    ...(derivatives.data ?? []).map((d) => d.storage_path),
  ].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("scans").remove(paths);

  const { error } = await supabase.from("letters").delete().eq("id", letter.id);
  if (error) throw error;

  const { data: counter } = await supabase
    .from("archive_counter")
    .select("owner_id, last_seq")
    .maybeSingle();
  if (counter && counter.last_seq === letter.fh_seq) {
    await supabase
      .from("archive_counter")
      .update({ last_seq: Math.max(letter.fh_seq - 1, 0) } as never)
      .eq("owner_id", counter.owner_id);
    return true;
  }
  return false;
}


export async function logEdits(
  letterId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const rows = Object.keys(after)
    .filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""))
    .map((k) => ({
      letter_id: letterId,
      entity: "letter",
      field_key: k,
      old_value: before[k] === null || before[k] === undefined ? null : String(before[k]),
      new_value: after[k] === null || after[k] === undefined ? null : String(after[k]),
    }));
  if (rows.length) await supabase.from("edit_history").insert(rows);
}

export async function signedUrl(path: string) {
  const { data } = await supabase.storage.from("scans").createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}
