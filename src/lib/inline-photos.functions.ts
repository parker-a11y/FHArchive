import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InlinePhoto } from "@/lib/inline-photos";

/**
 * Signs the archive photos embedded in a piece of text, so the recap editor and
 * recap page can show them without exposing the private storage buckets.
 */
export const signInlinePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string }) => ({ text: String(data.text ?? "").slice(0, 100000) }))
  .handler(async ({ data, context }): Promise<Record<string, InlinePhoto>> => {
    const { resolveInlinePhotos } = await import("@/lib/archive-email.server");
    return resolveInlinePhotos(context.supabase as never, context.userId, data.text, {
      shareLinks: false,
    });
  });
