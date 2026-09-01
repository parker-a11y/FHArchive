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
