import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";

export const suggestCollectionItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("can_edit_archive", {
      _user_id: context.userId,
    });
    if (error || !allowed)
      throw new Error("Only approved archive editors can request suggestions.");
    const { suggestItems } = await import("@/lib/collections/suggest.server");
    return suggestItems(context.supabase, data.collectionId, getRequest());
  });

export const resumeCollectionDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (error || !admin) throw new Error("Only the archive administrator can resume AI discovery.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: removeError } = await supabaseAdmin
      .from("collection_discovery_state")
      .delete()
      .eq("key", "gateway");
    if (removeError) throw removeError;
    return { resumed: true };
  });
