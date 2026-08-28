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
  physical_description: string | null;
  original_copy: string;
  storage_location: string | null;
  storage_type: string | null;
  storage_container: string | null;
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


export async function fetchLetters(): Promise<Letter[]> {
  const { data, error } = await supabase
    .from("letters")
    .select("*")
    .order("fh_seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Letter[];
}

export type ArchiveItemCounts = {
  totalItems: number;
  itemsScanned: number;
  totalScans: number;
};

/** Aggregate counts across child items and scans (whole archive). */
export async function fetchItemCounts(): Promise<ArchiveItemCounts> {
  const [itemsRes, scansRes] = await Promise.all([
    supabase.from("letter_items").select("id"),
    supabase.from("letter_scans").select("id,item_id"),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (scansRes.error) throw scansRes.error;
  const scans = (scansRes.data ?? []) as { id: string; item_id: string | null }[];
  const scannedItemIds = new Set(scans.map((s) => s.item_id).filter(Boolean) as string[]);
  return {
    totalItems: (itemsRes.data ?? []).length,
    itemsScanned: scannedItemIds.size,
    totalScans: scans.length,
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

export type NewLetterInput = {
  p_date_as_written?: string;
  p_normalized_date?: string;
  p_date_precision: string;
  p_date_certainty: string;
  p_author?: string;
  p_recipient?: string;
  p_origin?: string;
  p_destination?: string;
  p_period: string;
  p_sheets?: number;
  p_has_envelope: boolean;
  p_has_enclosures: boolean;
  p_notes?: string;
};

export async function createLetter(
  input: NewLetterInput,
): Promise<{ id: string; fh_seq: number; archive_id: string }> {
  // PostgREST requires every argument to be present (the function has no defaults).
  const payload = {
    p_date_as_written: input.p_date_as_written ?? null,
    p_normalized_date: input.p_normalized_date ?? null,
    p_date_precision: input.p_date_precision,
    p_date_certainty: input.p_date_certainty,
    p_author: input.p_author ?? null,
    p_recipient: input.p_recipient ?? null,
    p_origin: input.p_origin ?? null,
    p_destination: input.p_destination ?? null,
    p_period: input.p_period,
    p_sheets: input.p_sheets ?? null,
    p_has_envelope: input.p_has_envelope,
    p_has_enclosures: input.p_has_enclosures,
    p_notes: input.p_notes ?? null,
  };
  const { data, error } = await supabase.rpc("create_letter", payload as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { id: string; fh_seq: number; archive_id: string };
}


/**
 * Permanently deletes a letter (and, via cascade, its scans/links/history).
 * If it was the most recently issued FH number, the counter is rolled back so
 * the number is reused by the next record.
 */
export async function deleteLetter(letter: Pick<Letter, "id" | "fh_seq">): Promise<boolean> {
  const { data: scans } = await supabase
    .from("letter_scans")
    .select("storage_path")
    .eq("letter_id", letter.id);
  const paths = (scans ?? []).map((s) => s.storage_path).filter(Boolean);
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
