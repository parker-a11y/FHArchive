import { supabase } from "@/integrations/supabase/client";

export type SourceShare = {
  id: string;
  source_id: string;
  file_id: string | null;
  scope: "record" | "file";
  token: string;
  enabled: boolean;
  include_transcript: boolean;
  include_notes: boolean;
  public_note: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

export const DS_VISIBILITY = [
  { value: "private", label: "Private" },
  { value: "shared", label: "Shared by link" },
  { value: "published", label: "Published" },
] as const;

/** 32 hex chars of CSPRNG randomness — unguessable, never sequential. */
export function newShareToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sourceShareUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/d/${token}`;
}

export async function fetchSourceShares(sourceId: string): Promise<SourceShare[]> {
  const { data, error } = await supabase
    .from("source_shares")
    .select("*")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SourceShare[];
}

export async function createSourceShare(input: {
  sourceId: string;
  fileId?: string | null;
  includeTranscript?: boolean;
  includeNotes?: boolean;
}): Promise<SourceShare> {
  const { data, error } = await supabase
    .from("source_shares")
    .insert({
      source_id: input.sourceId,
      file_id: input.fileId ?? null,
      scope: input.fileId ? "file" : "record",
      token: newShareToken(),
      include_transcript: input.includeTranscript ?? true,
      include_notes: input.includeNotes ?? false,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  await markShared(input.sourceId);
  return data as SourceShare;
}

export async function updateSourceShare(id: string, patch: Partial<SourceShare>) {
  const { error } = await supabase
    .from("source_shares")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

/** Invalidates the old URL and issues a fresh one. */
export async function regenerateSourceShare(id: string) {
  const token = newShareToken();
  await updateSourceShare(id, { token, enabled: true, view_count: 0 } as Partial<SourceShare>);
  return token;
}

export async function deleteSourceShare(id: string) {
  const { error } = await supabase.from("source_shares").delete().eq("id", id);
  if (error) throw error;
}

async function markShared(sourceId: string) {
  const { data } = await supabase
    .from("digital_sources")
    .select("visibility")
    .eq("id", sourceId)
    .maybeSingle();
  if ((data as { visibility?: string } | null)?.visibility === "private") {
    await supabase
      .from("digital_sources")
      .update({ visibility: "shared" } as never)
      .eq("id", sourceId);
  }
}

export async function setSourceVisibility(sourceId: string, visibility: string) {
  const { error } = await supabase
    .from("digital_sources")
    .update({ visibility } as never)
    .eq("id", sourceId);
  if (error) throw error;
}
