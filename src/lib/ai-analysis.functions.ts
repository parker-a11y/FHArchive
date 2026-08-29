import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs AI analysis over a record's transcription and stores the output as
 * PENDING suggestions. Archival metadata is never written here.
 */
export const analyzeRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { letterId: string }) => {
    if (!input?.letterId) throw new Error("letterId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { buildAnalysisContext, analyzeRecordText, ANALYSIS_MODEL } = await import(
      "./ai-analysis.server"
    );

    const ctx = await buildAnalysisContext(supabase, data.letterId);
    if (!ctx.transcript) {
      throw new Error(
        "This record has no transcription yet. Transcribe the scans first, then run analysis.",
      );
    }

    const fields = await analyzeRecordText(ctx);
    const keys = Object.keys(fields);
    if (!keys.length) return { suggestions: 0 };

    // Replace only pending rows; accepted/rejected review history is preserved.
    const { data: existing } = await supabase
      .from("ai_suggestions")
      .select("field_key, status")
      .eq("letter_id", data.letterId);
    const locked = new Set(
      (existing ?? []).filter((r) => r.status !== "pending").map((r) => r.field_key),
    );

    const rows = keys
      .filter((k) => !locked.has(k))
      .map((k) => ({
        owner_id: userId,
        letter_id: data.letterId,
        field_key: k,
        content: fields[k]!,
        model: ANALYSIS_MODEL,
        status: "pending",
      }));

    if (rows.length) {
      const { error } = await supabase
        .from("ai_suggestions")
        .upsert(rows, { onConflict: "letter_id,field_key" });
      if (error) throw new Error(error.message);
    }

    return { suggestions: rows.length, skipped: keys.length - rows.length };
  });
