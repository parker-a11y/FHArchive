import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI drafting for Francis File Notes. Admin only; output is always a draft the
 * administrator edits and publishes by hand.
 */
export const draftFrancisFileNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { term: string; context?: string; section?: string }) => {
    if (!input?.term?.trim()) throw new Error("term is required");
    return {
      term: input.term.trim(),
      context: input.context?.slice(0, 4000),
      section: input.section,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: admin } = await supabase.rpc("is_admin", { _user_id: userId } as never);
    if (!admin) throw new Error("Only administrators can generate Francis File Notes");

    const { generateNoteDraft } = await import("./ffn.server");
    return await generateNoteDraft(data);
  });
