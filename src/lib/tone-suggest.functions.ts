import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Proposes tone / sentiment values for a correspondence record. Nothing is
 * saved — the archivist confirms the selections in the UI.
 */
export const suggestTones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { letterId: string; vocabulary: string[] }) => {
    if (!input?.letterId) throw new Error("letterId is required");
    return { letterId: input.letterId, vocabulary: input.vocabulary ?? [] };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { loadToneContext, suggestTonesForText } = await import("./tone-suggest.server");

    const ctx = await loadToneContext(supabase, data.letterId);
    if (!ctx.transcript) {
      return { matched: [] as string[], proposed: [] as string[], skipped: "no-transcription" };
    }
    const out = await suggestTonesForText(ctx.header, ctx.transcript, data.vocabulary);
    return { ...out, skipped: null as string | null };
  });
