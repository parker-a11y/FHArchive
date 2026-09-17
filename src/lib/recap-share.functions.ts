import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function newToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ensures a recap (weekly, custom, or blog post) has a public view-only link
 * (/p/<token>) and returns it. Admin only. The page renders the recap exactly
 * like the recap email, with public links to the records it cites.
 */
export const ensureRecapShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { recapId: string }) => ({ recapId: String(data.recapId) }))
  .handler(async ({ data, context }): Promise<{ url: string; created: boolean }> => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can create share links.");

    const { data: recap } = await db
      .from("weekly_recaps")
      .select("id, share_token")
      .eq("id", data.recapId)
      .maybeSingle();
    if (!recap) throw new Error("That recap could not be found.");

    const { PUBLIC_SITE_URL } = await import("@/lib/archive-email.server");
    const existing = (recap as { share_token?: string | null }).share_token;
    if (existing) return { url: `${PUBLIC_SITE_URL}/p/${existing}`, created: false };

    const token = newToken();
    const { error } = await db
      .from("weekly_recaps")
      .update({ share_token: token } as never)
      .eq("id", data.recapId);
    if (error) throw new Error(`Could not create a share link: ${error.message}`);
    return { url: `${PUBLIC_SITE_URL}/p/${token}`, created: true };
  });

/** Disables a recap's public link. Admin only. */
export const disableRecapShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { recapId: string }) => ({ recapId: String(data.recapId) }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can disable share links.");
    const { error } = await db
      .from("weekly_recaps")
      .update({ share_token: null } as never)
      .eq("id", data.recapId);
    if (error) throw new Error(`Could not disable the link: ${error.message}`);
    return { ok: true };
  });

export type SharedRecap = {
  title: string;
  lede: string | null;
  kind: string;
  weekRange: string;
  updatedAt: string;
};

/** Public, unauthenticated read of one shared recap. Whitelisted fields only. */
export const getSharedRecap = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data.token).slice(0, 64) }))
  .handler(async ({ data }): Promise<SharedRecap | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recapByShareToken } = await import("@/lib/recaps/email.server");
    const recap = await recapByShareToken(supabaseAdmin, data.token);
    if (!recap) return null;
    return {
      title: String(recap.title),
      lede: recap.lede == null ? null : String(recap.lede),
      kind: String(recap.kind),
      weekRange: String(recap.range_label ?? ""),
      updatedAt: String(recap.updated_at ?? recap.generated_at),
    };
  });

/**
 * Renders the shared recap exactly like the recap email — header, narrative,
 * featured scan, embedded photos, and public links to the records it cites —
 * as standalone HTML. Scan links are signed fresh so images still load.
 */
export const getSharedRecapHtml = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data.token).slice(0, 64) }))
  .handler(async ({ data }): Promise<string | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recapByShareToken, renderRecapHtml } = await import("@/lib/recaps/email.server");
    const recap = await recapByShareToken(supabaseAdmin, data.token);
    if (!recap) return null;
    return await renderRecapHtml(supabaseAdmin, recap, { publicLinks: true });
  });
