import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs AI analysis over a record's transcription and stores the output as
 * PENDING suggestions. Archival metadata is never written here.
 */
export const analyzeRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { letterId: string; mode?: "new" | "all" }) => {
    if (!input?.letterId) throw new Error("letterId is required");
    return { letterId: input.letterId, mode: input.mode === "all" ? "all" : "new" } as const;
  })
  .handler(async ({ data, context }) => {
    // Same dropped-bearer-header pitfall as Ask Francis: verify access and write
    // with the service client keyed by the verified user id, or PostgREST sees
    // auth.uid() as null and RLS rejects the insert.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: canEdit, error: accessErr } = await supabaseAdmin.rpc("can_edit_archive", {
      _user_id: context.userId,
    });
    if (accessErr) throw new Error("Could not verify your archive access. Please try again.");
    if (!canEdit) throw new Error("You do not have permission to run AI analysis.");

    const { buildAnalysisContext, analyzeRecordText, ANALYSIS_MODEL, ANALYSIS_FIELDS } =
      await import("./ai-analysis.server");

    const ctx = await buildAnalysisContext(supabaseAdmin, data.letterId);
    if (!ctx.transcript) {
      throw new Error(
        "This record has no transcription yet. Transcribe the scans first, then run analysis.",
      );
    }

    const fields = await analyzeRecordText(ctx);
    const keys = Object.keys(fields);

    // Location Line: stored as a suggestion only, never applied automatically.
    try {
      const { data: l } = await supabaseAdmin
        .from("letters")
        .select("dateline")
        .eq("id", data.letterId)
        .maybeSingle();
      if (!l?.dateline) {
        const { suggestLocationLine, storeLocationLineSuggestion } = await import(
          "./location-line.server"
        );
        const r = await suggestLocationLine(supabaseAdmin, data.letterId);
        if (r.hasTranscript)
          await storeLocationLineSuggestion(supabaseAdmin, data.letterId, r.suggestion ?? "");
      }
    } catch {
      // A failed location-line read must not sink the rest of the analysis.
    }

    // Anything the model no longer flags is dropped, so a superseded note (for
    // example an uncertain passage the archivist has since corrected) does not
    // linger on the record after a re-run.
    const stale = ANALYSIS_FIELDS.map(([k]) => k).filter((k) => !keys.includes(k));
    if (stale.length) {
      await supabaseAdmin
        .from("ai_suggestions")
        .delete()
        .eq("letter_id", data.letterId)
        .in("field_key", stale);
    }

    if (!keys.length) return { suggestions: 0, skipped: 0, cleared: stale.length };

    // "new" keeps reviewed rows untouched; "all" replaces everything.
    const locked = new Set<string>();
    if (data.mode === "new") {
      const { data: existing } = await supabaseAdmin
        .from("ai_suggestions")
        .select("field_key, status")
        .eq("letter_id", data.letterId);
      for (const r of existing ?? []) if (r.status !== "pending") locked.add(r.field_key);
    }

    const rows = keys
      .filter((k) => !locked.has(k))
      .map((k) => ({
        owner_id: context.userId,
        letter_id: data.letterId,
        field_key: k,
        content: fields[k]!,
        model: ANALYSIS_MODEL,
        status: "pending",
      }));

    if (rows.length) {
      const { error } = await supabaseAdmin
        .from("ai_suggestions")
        .upsert(rows, { onConflict: "letter_id,field_key" });
      if (error) throw new Error(error.message);
    }

    return {
      suggestions: rows.length,
      skipped: keys.length - rows.length,
      cleared: stale.length,
    };
  });
