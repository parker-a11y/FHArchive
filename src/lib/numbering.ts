import { supabase } from "@/integrations/supabase/client";

export type Retirement = {
  id: string;
  fh_seq: number;
  archive_id: string;
  reason: string;
  retired_at: string;
};

export type NumberingGap = {
  fh_seq: number;
  archive_id: string;
  retirement: Retirement | null;
};

export const fhId = (seq: number) => `FH${String(seq).padStart(4, "0")}`;

export async function fetchRetirements(): Promise<Retirement[]> {
  const { data, error } = await (supabase.from("archive_id_retirements" as any) as any)
    .select("id,fh_seq,archive_id,reason,retired_at")
    .order("fh_seq");
  if (error) throw new Error(error.message);
  return (data ?? []) as Retirement[];
}

export async function fetchRetirement(archiveId: string): Promise<Retirement | null> {
  const { data } = await (supabase.from("archive_id_retirements" as any) as any)
    .select("id,fh_seq,archive_id,reason,retired_at")
    .eq("archive_id", archiveId.toUpperCase())
    .maybeSingle();
  return (data ?? null) as Retirement | null;
}

/**
 * Every FH number below the highest known one that has no record behind it.
 *
 * The counter row is admin-readable only, so the end of the sequence is taken
 * as the highest of: the counter, the highest saved record, and the highest
 * retired number. That way the page still works when the counter is hidden.
 */
export async function fetchNumberingGaps(): Promise<NumberingGap[]> {
  const [{ data: counter }, { data: used }, retirements] = await Promise.all([
    (supabase.from("archive_counter" as any) as any).select("last_seq").maybeSingle(),
    supabase.from("letters").select("fh_seq"),
    fetchRetirements(),
  ]);
  const have = new Set((used ?? []).map((r: { fh_seq: number }) => r.fh_seq));
  const last = Math.max(
    (counter?.last_seq as number) ?? 0,
    ...[...have, 0],
    ...retirements.map((r) => r.fh_seq),
    0,
  );
  const bySeq = new Map(retirements.map((r) => [r.fh_seq, r]));
  const gaps: NumberingGap[] = [];
  for (let seq = 1; seq <= last; seq++) {
    if (have.has(seq)) continue;
    gaps.push({ fh_seq: seq, archive_id: fhId(seq), retirement: bySeq.get(seq) ?? null });
  }
  return gaps;
}

export async function saveRetirementReason(seq: number, reason: string) {
  const archive_id = fhId(seq);
  const existing = await fetchRetirement(archive_id);
  const table = supabase.from("archive_id_retirements" as any) as any;
  const { error } = existing
    ? await table.update({ reason }).eq("id", existing.id)
    : await table.insert({ fh_seq: seq, archive_id, reason });
  if (error) throw new Error(error.message);
}
