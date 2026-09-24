import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function newToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Creates (or reuses) a public view-only link for one Ask Francis answer. Admin only. */
export const ensureAskShareLink = createServerFn({ method: "POST" })
  .inputValidator((data: { queryId: string }) => ({ queryId: String(data.queryId) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ url: string; created: boolean }> => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can create share links.");

    const { data: row } = await db
      .from("ask_francis_queries")
      .select("id, share_token")
      .eq("id", data.queryId)
      .maybeSingle();
    if (!row) throw new Error("That question could not be found.");

    const { PUBLIC_SITE_URL } = await import("@/lib/archive-email.server");
    const existing = (row as { share_token?: string | null }).share_token;
    if (existing) return { url: `${PUBLIC_SITE_URL}/a/${existing}`, created: false };

    const token = newToken();
    const { error } = await db
      .from("ask_francis_queries")
      .update({ share_token: token } as never)
      .eq("id", data.queryId);
    if (error) throw new Error(`Could not create a share link: ${error.message}`);
    return { url: `${PUBLIC_SITE_URL}/a/${token}`, created: true };
  });

/** Turns off an Ask Francis answer's public link. Admin only. */
export const disableAskShareLink = createServerFn({ method: "POST" })
  .inputValidator((data: { queryId: string }) => ({ queryId: String(data.queryId) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can disable share links.");
    const { error } = await db
      .from("ask_francis_queries")
      .update({ share_token: null } as never)
      .eq("id", data.queryId);
    if (error) throw new Error(`Could not disable the link: ${error.message}`);
    return { ok: true };
  });

export type SharedAsk = {
  question: string;
  answer: string;
  confidence: string | null;
  askedAt: string;
  citations: { archiveId: string; url: string | null; note?: string }[];
  sources: { title?: string; url: string }[];
};

/** Public, unauthenticated read of one shared Ask Francis answer. */
export const getSharedAsk = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data.token).slice(0, 64) }))
  .handler(async ({ data }): Promise<SharedAsk | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("ask_francis_queries")
      .select("question, answer, confidence, citations, sources, created_at, error")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!row) return null;
    const r = row as {
      question: string;
      answer: string | null;
      confidence: string | null;
      citations: { archive_id: string; note?: string }[] | null;
      sources: { title?: string; url: string }[] | null;
      created_at: string;
      error: string | null;
    };
    if (r.error || !r.answer) return null;

    const refs = (r.citations ?? []).map((c) => c.archive_id);
    let links: Record<string, string> = {};
    if (refs.length) {
      const { ensureShareLinksForRefs } = await import("@/lib/archive-email.server");
      const { data: owner } = await supabaseAdmin
        .from("letters")
        .select("owner_id")
        .not("owner_id", "is", null)
        .limit(1)
        .maybeSingle();
      const ownerId = (owner as { owner_id?: string } | null)?.owner_id;
      if (ownerId) {
        try {
          links = await ensureShareLinksForRefs(supabaseAdmin as never, ownerId, refs, true);
        } catch {
          links = {};
        }
      }
    }

    return {
      question: r.question,
      answer: r.answer,
      confidence: r.confidence,
      askedAt: r.created_at,
      citations: (r.citations ?? []).map((c) => ({
        archiveId: c.archive_id,
        url: links[c.archive_id.toUpperCase()] ?? null,
        note: c.note,
      })),
      sources: r.sources ?? [],
    };
  });
