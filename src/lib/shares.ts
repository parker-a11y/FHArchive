import { supabase } from "@/integrations/supabase/client";

export type RecordShare = {
  id: string;
  letter_id: string;
  file_id: string | null;
  scope: "record" | "file";
  token: string;
  enabled: boolean;
  include_transcription: boolean;
  include_notes: boolean;
  public_note: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

export const VISIBILITY = [
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

export function shareUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/s/${token}`;
}

export async function fetchShares(letterId: string): Promise<RecordShare[]> {
  const { data, error } = await supabase
    .from("record_shares")
    .select("*")
    .eq("letter_id", letterId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RecordShare[];
}

export async function createShare(input: {
  letterId: string;
  fileId?: string | null;
  includeTranscription?: boolean;
  includeNotes?: boolean;
}): Promise<RecordShare> {
  const { data, error } = await supabase
    .from("record_shares")
    .insert({
      letter_id: input.letterId,
      file_id: input.fileId ?? null,
      scope: input.fileId ? "file" : "record",
      token: newShareToken(),
      include_transcription: input.includeTranscription ?? true,
      include_notes: input.includeNotes ?? false,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  await markShared(input.letterId);
  return data as RecordShare;
}

export async function updateShare(id: string, patch: Partial<RecordShare>) {
  const { error } = await supabase
    .from("record_shares")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

/** Invalidates the old URL and issues a fresh one. */
export async function regenerateShare(id: string) {
  const token = newShareToken();
  await updateShare(id, { token, enabled: true, view_count: 0 } as Partial<RecordShare>);
  return token;
}

export async function deleteShare(id: string) {
  const { error } = await supabase.from("record_shares").delete().eq("id", id);
  if (error) throw error;
}

async function markShared(letterId: string) {
  const { data } = await supabase
    .from("letters")
    .select("visibility")
    .eq("id", letterId)
    .maybeSingle();
  if ((data as { visibility?: string } | null)?.visibility === "private") {
    await supabase.from("letters").update({ visibility: "shared" } as never).eq("id", letterId);
  }
}

export async function setVisibility(letterId: string, visibility: string) {
  const { error } = await supabase
    .from("letters")
    .update({ visibility } as never)
    .eq("id", letterId);
  if (error) throw error;
}
