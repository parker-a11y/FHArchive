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
  created_at: string;
  updated_at: string;
};

export async function fetchLetters(): Promise<Letter[]> {
  const { data, error } = await supabase
    .from("letters")
    .select("*")
    .order("fh_seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Letter[];
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

export async function nextArchiveId(): Promise<{ fh_seq: number; archive_id: string }> {
  const { data, error } = await supabase.rpc("next_archive_id");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { fh_seq: number; archive_id: string };
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
