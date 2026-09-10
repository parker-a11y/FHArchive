import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI suggestions for the Location Line (place written on the letter itself).
 * Suggestions land in letters.dateline_suggested and are never applied to the
 * real Location Line without an archivist accepting them.
 */
export const suggestLocationLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { letterIds?: string[]; limit?: number; force?: boolean }) => ({
    letterIds: Array.isArray(input?.letterIds) ? input.letterIds.filter(Boolean) : undefined,
    limit: Math.min(Math.max(Number(input?.limit) || 4, 1), 10),
    force: !!input?.force,
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: canEdit, error: accessErr } = await supabaseAdmin.rpc("can_edit_archive", {
      _user_id: context.userId,
    });
    if (accessErr) throw new Error("Could not verify your archive access. Please try again.");
    if (!canEdit) throw new Error("You do not have permission to run AI suggestions.");

    const { suggestLocationLine, storeLocationLineSuggestion } = await import(
      "./location-line.server"
    );

    // Bulk candidates need an empty Location Line. A forced, targeted request is
    // an explicit second opinion and must still read a record with a saved value.
    let q = supabaseAdmin
      .from("letters")
      .select("id, archive_id")
      .order("fh_seq");
    const targetedForce = !!data.letterIds?.length && data.force;
    if (!targetedForce) q = q.is("dateline", null);
    if (data.letterIds?.length) q = q.in("id", data.letterIds);
    if (!data.force) q = q.is("dateline_suggested", null);

    const { data: candidates, error } = await q;
    if (error) throw new Error(error.message);
    const all = candidates ?? [];
    const batch = all.slice(0, data.limit);

    let filled = 0;
    let skipped = 0;
    const results: { id: string; archiveId: string; suggestion: string | null }[] = [];
    for (const l of batch) {
      const r = await suggestLocationLine(supabaseAdmin, l.id);
      if (!r.hasTranscript) {
        // Nothing to read yet: mark as checked so the backfill moves on, but
        // leave it re-checkable later by a per-record request.
        await storeLocationLineSuggestion(supabaseAdmin, l.id, "");
        skipped++;
        results.push({ id: l.id, archiveId: l.archive_id, suggestion: null });
        continue;
      }
      await storeLocationLineSuggestion(supabaseAdmin, l.id, r.suggestion ?? "");
      if (r.suggestion) filled++;
      results.push({ id: l.id, archiveId: l.archive_id, suggestion: r.suggestion ?? null });
    }

    return {
      processed: batch.length,
      filled,
      skipped,
      remaining: Math.max(all.length - batch.length, 0),
      results,
    };
  });
