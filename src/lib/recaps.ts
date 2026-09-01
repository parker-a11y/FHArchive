import { supabase } from "@/integrations/supabase/client";

export type WeeklyRecap = {
  id: string;
  week_start: string;
  week_end: string;
  title: string;
  lede: string | null;
  body_md: string;
  related_ids: string[];
  image_bucket: string | null;
  image_path: string | null;
  image_archive_id: string | null;
  image_caption: string | null;
  stats: Record<string, number> | null;
  model: string | null;
  status: string;
  manually_edited: boolean;
  generated_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, week_start, week_end, title, lede, body_md, related_ids, image_bucket, image_path, image_archive_id, image_caption, stats, model, status, manually_edited, generated_at, updated_at";

export async function fetchRecaps(): Promise<WeeklyRecap[]> {
  const { data, error } = await supabase
    .from("weekly_recaps")
    .select(COLUMNS)
    .order("week_start", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as WeeklyRecap[];
}

export async function fetchRecap(weekStart: string): Promise<WeeklyRecap | null> {
  const { data, error } = await supabase
    .from("weekly_recaps")
    .select(COLUMNS)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as WeeklyRecap | null;
}

/** Saved edits always mark the recap as manually edited, so regeneration can warn. */
export async function saveRecapEdits(
  id: string,
  patch: { title?: string; lede?: string; body_md?: string },
): Promise<void> {
  const { error } = await supabase
    .from("weekly_recaps")
    .update({ ...patch, manually_edited: true })
    .eq("id", id);
  if (error) throw error;
}

export async function setRecapStatus(id: string, status: "published" | "draft"): Promise<void> {
  const { error } = await supabase.from("weekly_recaps").update({ status }).eq("id", id);
  if (error) throw error;
}

/** The JPEG derivative only — archival TIFF masters are never displayed. */
export async function signRecapImage(recap: WeeklyRecap): Promise<string | null> {
  if (!recap.image_path) return null;
  const { data } = await supabase.storage
    .from(recap.image_bucket || "scans")
    .createSignedUrl(recap.image_path, 3600);
  return data?.signedUrl ?? null;
}

export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (s: string, withYear: boolean) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      ...(withYear ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    });
  const sameYear = weekStart.slice(0, 4) === weekEnd.slice(0, 4);
  return `${fmt(weekStart, !sameYear)} – ${fmt(weekEnd, true)}`;
}

export type RecapShare = {
  kind: "letter" | "source";
  /** The record row id, used when revoking. */
  id: string;
  ref: string;
  url: string;
  viewCount: number;
};

const SITE = "https://fharchive.com";

/** Enabled public links for the FH / DS records referenced by a recap. */
export async function fetchRecapShares(refs: string[]): Promise<RecapShare[]> {
  if (!refs.length) return [];
  const upper = refs.map((r) => r.toUpperCase());
  const fh = upper.filter((r) => r.startsWith("FH"));
  const ds = Array.from(
    new Set(
      upper
        .filter((r) => r.startsWith("DS"))
        .flatMap((r) => [r, r.replace(/^DS-?/, "DS-"), r.replace(/-/g, "")]),
    ),
  );
  const out: RecapShare[] = [];

  if (fh.length) {
    const { data: letters } = await supabase
      .from("letters")
      .select("id, archive_id")
      .in("archive_id", fh);
    const ids = (letters ?? []).map((l) => l.id);
    if (ids.length) {
      const { data: rows } = await supabase
        .from("record_shares")
        .select("letter_id, token, view_count")
        .in("letter_id", ids)
        .eq("scope", "record")
        .eq("enabled", true);
      for (const r of rows ?? []) {
        const ref = (letters ?? []).find((l) => l.id === r.letter_id)?.archive_id;
        if (!ref) continue;
        out.push({
          kind: "letter",
          id: r.letter_id,
          ref,
          url: `${SITE}/s/${r.token}`,
          viewCount: r.view_count ?? 0,
        });
      }
    }
  }

  if (ds.length) {
    const { data: sources } = await supabase
      .from("digital_sources")
      .select("id, ds_id")
      .in("ds_id", ds);
    const ids = (sources ?? []).map((s) => s.id);
    if (ids.length) {
      const { data: rows } = await supabase
        .from("source_shares")
        .select("source_id, token, view_count")
        .in("source_id", ids)
        .eq("scope", "record")
        .eq("enabled", true);
      for (const r of rows ?? []) {
        const ref = (sources ?? []).find((s) => s.id === r.source_id)?.ds_id;
        if (!ref) continue;
        out.push({
          kind: "source",
          id: r.source_id,
          ref,
          url: `${SITE}/d/${r.token}`,
          viewCount: r.view_count ?? 0,
        });
      }
    }
  }

  return out.sort((a, b) => a.ref.localeCompare(b.ref));
}

/** Revoke (or restore) every record-scope public link for one record. */
export async function setRecapShareEnabled(
  kind: "letter" | "source",
  id: string,
  enabled: boolean,
) {
  const query =
    kind === "letter"
      ? supabase.from("record_shares").update({ enabled } as never).eq("letter_id", id)
      : supabase.from("source_shares").update({ enabled } as never).eq("source_id", id);
  const { error } = await query.eq("scope", "record");
  if (error) throw error;
}
