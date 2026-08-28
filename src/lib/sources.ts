import { supabase } from "@/integrations/supabase/client";

export const DS_SOURCE_TYPES = [
  { value: "website", label: "Web archive / Website" },
  { value: "video", label: "Video (YouTube, film)" },
  { value: "audio", label: "Audio recording" },
  { value: "book", label: "Book" },
  { value: "article", label: "Article / Paper" },
  { value: "newspaper", label: "Newspaper / Magazine" },
  { value: "photograph", label: "Photograph / Image collection" },
  { value: "map", label: "Map" },
  { value: "database", label: "Database / Finding aid" },
  { value: "government", label: "Government / Military record" },
  { value: "interview", label: "Interview / Oral history" },
  { value: "other", label: "Other" },
] as const;

export function dsTypeLabel(value: string) {
  return DS_SOURCE_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function formatDsId(seq: number) {
  return `DS-${String(seq).padStart(4, "0")}`;
}

export type DigitalSource = {
  id: string;
  ds_seq: number;
  ds_id: string;
  title: string;
  source_type: string;
  creator: string | null;
  institution: string | null;
  original_date: string | null;
  normalized_date: string | null;
  date_precision: string;
  date_accessed: string | null;
  historical_date_range: string | null;
  url: string | null;
  description: string | null;
  notes: string | null;
  transcript: string | null;
  rights_notes: string | null;
  citation: string | null;
  local_file_path: string | null;
  created_at: string;
  updated_at: string;
};

/* ---------------- Preservation copies (uploaded files) ---------------- */

export const DS_FILE_TYPES = [
  { value: "image", label: "Image" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "document", label: "Document" },
  { value: "other", label: "Other" },
] as const;

export type DsFile = {
  id: string;
  source_id: string;
  storage_path: string;
  original_filename: string | null;
  file_label: string;
  file_type: string;
  mime_type: string | null;
  file_size: number | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
};

/** Best-guess bucket for a browser File, used to pick the right preview. */
export function inferFileType(file: File): string {
  const m = file.type;
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf" || m.startsWith("text/")) return "document";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "tif", "tiff", "heic"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a", "aac", "flac", "ogg"].includes(ext)) return "audio";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) return "document";
  return "other";
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function fetchDsFiles(sourceId: string): Promise<DsFile[]> {
  const { data, error } = await supabase
    .from("ds_files")
    .select("*")
    .eq("source_id", sourceId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DsFile[];
}

/** Map of source_id -> number of preservation copies, for list badges. */
export async function fetchDsFileCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("ds_files").select("source_id");
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.source_id] = (map[row.source_id] ?? 0) + 1;
  return map;
}


export type DsSegment = {
  id: string;
  source_id: string;
  sort_order: number;
  start_ts: string | null;
  end_ts: string | null;
  title: string;
  description: string | null;
  url: string | null;
  keywords: string | null;
};

export async function fetchSources(): Promise<DigitalSource[]> {
  const { data, error } = await supabase
    .from("digital_sources")
    .select("*")
    .order("ds_seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DigitalSource[];
}

export async function fetchSourceByDsId(dsId: string): Promise<DigitalSource | null> {
  const { data, error } = await supabase
    .from("digital_sources")
    .select("*")
    .eq("ds_id", dsId)
    .maybeSingle();
  if (error) throw error;
  return (data as DigitalSource) ?? null;
}

export async function previewNextDsId(): Promise<{ ds_seq: number; ds_id: string }> {
  const { data, error } = await supabase.rpc("preview_next_ds_id");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { ds_seq: number; ds_id: string };
}

export type NewSourceInput = {
  title: string;
  source_type: string;
  creator?: string;
  institution?: string;
  original_date?: string;
  date_accessed?: string;
  historical_date_range?: string;
  url?: string;
  description?: string;
  notes?: string;
};

export async function createDigitalSource(
  input: NewSourceInput,
): Promise<{ id: string; ds_seq: number; ds_id: string }> {
  // PostgREST requires every argument present (function has no defaults).
  const payload = {
    p_title: input.title,
    p_source_type: input.source_type,
    p_creator: input.creator || null,
    p_institution: input.institution || null,
    p_original_date: input.original_date || null,
    p_date_accessed: input.date_accessed || null,
    p_historical_date_range: input.historical_date_range || null,
    p_url: input.url || null,
    p_description: input.description || null,
    p_notes: input.notes || null,
  };
  const { data, error } = await supabase.rpc("create_digital_source", payload as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { id: string; ds_seq: number; ds_id: string };
}

export async function fetchSegments(sourceId: string): Promise<DsSegment[]> {
  const { data, error } = await supabase
    .from("ds_segments")
    .select("*")
    .eq("source_id", sourceId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DsSegment[];
}

/** FH records linked to a digital source, with the explanation for each link. */
export async function fetchSourceLetters(sourceId: string) {
  const { data, error } = await supabase
    .from("letter_sources")
    .select("id, explanation, letter_id, letters(archive_id, title, author, recipient)")
    .eq("source_id", sourceId);
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    explanation: string | null;
    letter_id: string;
    letters: { archive_id: string; title: string | null; author: string | null; recipient: string | null } | null;
  }[];
}

/** Digital sources linked to an FH record. */
export async function fetchLetterSources(letterId: string) {
  const { data, error } = await supabase
    .from("letter_sources")
    .select("id, explanation, source_id, digital_sources(ds_id, title, source_type, url)")
    .eq("letter_id", letterId);
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    explanation: string | null;
    source_id: string;
    digital_sources: { ds_id: string; title: string; source_type: string; url: string | null } | null;
  }[];
}
