import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the unlisted public link for one FH record, minting one only when
 * the record has no enabled record-scope share yet. Admin only — the same
 * tokens the recap and archive emails already use.
 */
export const ensureRecordShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { letterId: string }) => ({ letterId: String(data.letterId) }))
  .handler(async ({ data, context }): Promise<{ url: string; created: boolean }> => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can create share links.");

    const { data: existing } = await db
      .from("record_shares")
      .select("token")
      .eq("letter_id", data.letterId)
      .eq("scope", "record")
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();

    const { PUBLIC_SITE_URL } = await import("@/lib/archive-email.server");
    if (existing) {
      return { url: `${PUBLIC_SITE_URL}/s/${(existing as { token: string }).token}`, created: false };
    }

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await db.from("record_shares").insert({
      owner_id: context.userId,
      letter_id: data.letterId,
      scope: "record",
      token,
      include_transcription: true,
      include_notes: false,
    } as never);
    if (error) throw new Error(`Could not create a share link: ${error.message}`);
    await db.from("letters").update({ visibility: "shared" } as never).eq("id", data.letterId);

    return { url: `${PUBLIC_SITE_URL}/s/${token}`, created: true };
  });
