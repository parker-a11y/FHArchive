import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function assertAccess(context: any, needEdit: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: canEdit }, { data: canRead }] = await Promise.all([
    supabaseAdmin.rpc("can_edit_archive", { _user_id: context.userId }),
    supabaseAdmin.rpc("can_read_archive", { _user_id: context.userId }),
  ]);
  if (needEdit && !canEdit) throw new Error("Only administrators and archivists can change historical context.");
  if (!canRead && !canEdit) throw new Error("You do not have access to the archive.");
  return { supabaseAdmin, canEdit: !!canEdit };
}

/** Loads the saved narrative for a date, generating and storing it on first request. */
export const getDateContextFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { date: string }) => {
    const date = String(data?.date ?? "");
    if (!ISO.test(date)) throw new Error("Invalid date.");
    return { date };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await assertAccess(context, false);
    const { ensureDateContext } = await import("@/lib/on-this-date.server");
    return ensureDateContext(supabaseAdmin, data.date);
  });

/** Explicit regeneration — replaces any manual edits. */
export const regenerateDateContextFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { date: string }) => {
    const date = String(data?.date ?? "");
    if (!ISO.test(date)) throw new Error("Invalid date.");
    return { date };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await assertAccess(context, true);
    const { regenerateDateContext } = await import("@/lib/on-this-date.server");
    return regenerateDateContext(supabaseAdmin, data.date);
  });

/** Saves hand-edited narrative text and sources; the edit is never overwritten automatically. */
export const saveDateContextFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      date: string;
      narrative_md: string;
      sources?: { title: string; publisher?: string | null; url?: string | null }[];
    }) => {
      const date = String(data?.date ?? "");
      if (!ISO.test(date)) throw new Error("Invalid date.");
      return {
        date,
        narrative_md: String(data?.narrative_md ?? "").slice(0, 20000),
        sources: (data?.sources ?? []).slice(0, 12).map((s) => ({
          title: String(s.title ?? "Source").slice(0, 200),
          publisher: s.publisher ? String(s.publisher).slice(0, 160) : null,
          url: s.url ? String(s.url).slice(0, 500) : null,
        })),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await assertAccess(context, true);
    const { data: row, error } = await supabaseAdmin
      .from("date_contexts")
      .update({
        narrative_md: data.narrative_md,
        sources: data.sources,
        manually_edited: true,
        last_edited_at: new Date().toISOString(),
      } as never)
      .eq("on_date", data.date)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

/** Internal editorial status only — it never affects who can see the narrative. */
export const setDateReviewedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { date: string; reviewed: boolean }) => {
    const date = String(data?.date ?? "");
    if (!ISO.test(date)) throw new Error("Invalid date.");
    return { date, reviewed: Boolean(data?.reviewed) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await assertAccess(context, true);
    const { data: row, error } = await supabaseAdmin
      .from("date_contexts")
      .update({
        reviewed: data.reviewed,
        reviewed_at: data.reviewed ? new Date().toISOString() : null,
        reviewed_by: data.reviewed ? context.userId : null,
      } as never)
      .eq("on_date", data.date)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });
