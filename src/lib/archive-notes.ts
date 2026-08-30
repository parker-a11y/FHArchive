import { supabase } from "@/integrations/supabase/client";

export type PostNoteInput = {
  title?: string | null;
  body: string;
  authorId?: string | undefined;
  authorName?: string | null;
};

/** Shared insert used by the notes ledger composer and the star flow. */
export async function postArchiveNote(input: PostNoteInput): Promise<void> {
  const text = input.body.trim();
  if (!text) throw new Error("Note cannot be empty.");
  const { error } = await supabase.from("archive_notes").insert({
    title: input.title?.trim() || null,
    body: text,
    author_name: input.authorName ?? null,
    author_id: input.authorId,
  });
  if (error) throw error;
}
