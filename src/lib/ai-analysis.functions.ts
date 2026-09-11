import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Runs AI analysis over a record's transcription and stores the output as
 * PENDING suggestions. Archival metadata is never written here.
 */
export const analyzeRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { letterId: string; mode?: "new" | "all" | "refresh" }) => {
    if (!input?.letterId) throw new Error("letterId is required");
    const mode =
      input.mode === "all" ? "all" : input.mode === "refresh" ? "refresh" : "new";
    return { letterId: input.letterId, mode } as const;
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

    const { data: existingRows } = await supabaseAdmin
      .from("ai_suggestions")
      .select("field_key, status, content")
      .eq("letter_id", data.letterId);
    const existing = existingRows ?? [];

    // Fingerprint of the text the last review was based on. A refresh whose
    // transcription has not moved costs nothing and changes nothing.
    const hash = await sha256(ctx.transcript);
    if (data.mode === "refresh") {
      const { data: l } = await supabaseAdmin
        .from("letters")
        .select("ai_source_hash")
        .eq("id", data.letterId)
        .maybeSingle();
      if (existing.length && l?.ai_source_hash === hash)
        return { suggestions: 0, skipped: 0, cleared: 0, updated: 0, unchanged: existing.length };
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

    await supabaseAdmin
      .from("letters")
      .update({ ai_source_hash: hash })
      .eq("id", data.letterId);

    if (!keys.length)
      return { suggestions: 0, skipped: 0, cleared: stale.length, updated: 0, unchanged: 0 };

    const byKey = new Map(existing.map((r) => [r.field_key, r]));
    const now = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    let skipped = 0;
    let updated = 0;
    let unchanged = 0;

    for (const key of keys) {
      const prev = byKey.get(key);
      const content = fields[key]!;
      const base = {
        owner_id: context.userId,
        letter_id: data.letterId,
        field_key: key,
        content,
        model: ANALYSIS_MODEL,
      };

      if (data.mode === "all" || !prev || prev.status === "pending") {
        rows.push({ ...base, status: "pending", previous_content: null, superseded_at: null });
        continue;
      }

      // "new" leaves every reviewed field alone. "refresh" only reopens a field
      // whose answer actually moved, and keeps the accepted text for comparison.
      if (data.mode === "new" || prev.status === "rejected") {
        skipped++;
        continue;
      }

      if (sameAnswer(prev.content ?? "", content)) {
        unchanged++;
        continue;
      }

      rows.push({
        ...base,
        status: "pending",
        previous_content: prev.content ?? "",
        superseded_at: now,
      });
      updated++;
    }

    if (rows.length) {
      const { error } = await supabaseAdmin
        .from("ai_suggestions")
        .upsert(rows as never, { onConflict: "letter_id,field_key" });
      if (error) throw new Error(error.message);
    }

    return { suggestions: rows.length, skipped, cleared: stale.length, updated, unchanged };
  });

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Whitespace/case/order-insensitive comparison of two suggestion answers. */
function sameAnswer(a: string, b: string) {
  const norm = (s: string) =>
    s
      .split(/[\n,;]+/)
      .map((p) => p.trim().toLowerCase().replace(/\s+/g, " "))
      .filter(Boolean)
      .sort()
      .join("|");
  return norm(a) === norm(b);
}
