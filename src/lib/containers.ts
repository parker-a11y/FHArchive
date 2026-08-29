import { supabase } from "@/integrations/supabase/client";

export const CONTAINER_BUCKET = "container-photos";

export const CONTAINER_TYPES = [
  { value: "box", label: "Box" },
  { value: "trunk", label: "Trunk / chest" },
  { value: "suitcase", label: "Suitcase" },
  { value: "album", label: "Album / scrapbook" },
  { value: "envelope", label: "Envelope / packet" },
  { value: "folder", label: "Folder / file" },
  { value: "bundle", label: "Bundle (tied group)" },
  { value: "drawer", label: "Drawer / cabinet" },
  { value: "bag", label: "Bag" },
  { value: "other", label: "Other" },
] as const;

export const CONTAINER_PROCESSING_STATUS = [
  { value: "unprocessed", label: "Unprocessed" },
  { value: "in_progress", label: "In progress" },
  { value: "processed", label: "Processed" },
  { value: "rehoused", label: "Rehoused / retired" },
] as const;

export function containerTypeLabel(v: string) {
  return CONTAINER_TYPES.find((t) => t.value === v)?.label ?? v;
}

export function containerStatusLabel(v: string) {
  return CONTAINER_PROCESSING_STATUS.find((t) => t.value === v)?.label ?? v;
}

export type SourceContainer = {
  id: string;
  box_seq: number;
  box_id: string;
  title: string;
  description: string | null;
  container_type: string;
  inscriptions: string | null;
  condition: string | null;
  notes: string | null;
  processing_status: string;
  date_photographed: string | null;
  artifact_letter_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ContainerFile = {
  id: string;
  container_id: string;
  storage_path: string;
  original_filename: string | null;
  file_label: string;
  mime_type: string | null;
  file_size: number | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
};

export async function fetchContainers(): Promise<SourceContainer[]> {
  const { data, error } = await supabase
    .from("source_containers")
    .select("*")
    .order("box_seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SourceContainer[];
}

export async function fetchContainerByBoxId(boxId: string): Promise<SourceContainer | null> {
  const { data, error } = await supabase
    .from("source_containers")
    .select("*")
    .eq("box_id", boxId)
    .maybeSingle();
  if (error) throw error;
  return (data as SourceContainer) ?? null;
}

export async function createContainer(input: {
  title: string;
  container_type: string;
  description?: string;
  inscriptions?: string;
  condition?: string;
  notes?: string;
  processing_status?: string;
  date_photographed?: string;
}): Promise<{ id: string; box_seq: number; box_id: string }> {
  const { data, error } = await supabase.rpc("create_source_container", {
    p_title: input.title,
    p_container_type: input.container_type || "box",
    p_description: input.description || null,
    p_inscriptions: input.inscriptions || null,
    p_condition: input.condition || null,
    p_notes: input.notes || null,
    p_processing_status: input.processing_status || "unprocessed",
    p_date_photographed: input.date_photographed || null,
  } as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { id: string; box_seq: number; box_id: string };
}

export async function updateContainer(id: string, patch: Partial<SourceContainer>) {
  const { error } = await supabase
    .from("source_containers")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteContainer(container: SourceContainer) {
  const { data: files } = await supabase
    .from("container_files")
    .select("storage_path")
    .eq("container_id", container.id);
  const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(CONTAINER_BUCKET).remove(paths);
  const { error } = await supabase.from("source_containers").delete().eq("id", container.id);
  if (error) throw error;
}

export async function fetchContainerFiles(containerId: string): Promise<ContainerFile[]> {
  const { data, error } = await supabase
    .from("container_files")
    .select("*")
    .eq("container_id", containerId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContainerFile[];
}

/** Records whose original provenance is this container. */
export async function fetchContainerRecords(containerId: string) {
  const { data, error } = await supabase
    .from("letters")
    .select("id, archive_id, title, record_type, author, recipient, original_order_notes")
    .eq("source_container_id", containerId)
    .order("fh_seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    archive_id: string;
    title: string | null;
    record_type: string;
    author: string | null;
    recipient: string | null;
    original_order_notes: string | null;
  }[];
}

/** Map of container id -> number of FH records attributed to it. */
export async function fetchContainerRecordCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("letters")
    .select("source_container_id")
    .not("source_container_id", "is", null);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { source_container_id: string }[]) {
    counts[row.source_container_id] = (counts[row.source_container_id] ?? 0) + 1;
  }
  return counts;
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Remembers the container being processed so consecutive FH entries inherit it. */
const CARRY_KEY = "fh:last-source-container";

export function getCarriedContainer(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CARRY_KEY) ?? "";
}

export function setCarriedContainer(id: string) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(CARRY_KEY, id);
  else window.localStorage.removeItem(CARRY_KEY);
}
