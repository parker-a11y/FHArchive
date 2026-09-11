import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Re-checks every FH record's stored scan / transcription status against what
 * is actually in the archive (files + page transcriptions) and repairs drift.
 * Never touches records marked transcription_status = 'not_required'.
 */
export const recomputeRecordStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: canEdit, error: accessErr } = await supabaseAdmin.rpc("can_edit_archive", {
      _user_id: context.userId,
    });
    if (accessErr) throw new Error("Could not verify your archive access. Please try again.");
    if (!canEdit) throw new Error("You do not have permission to update record statuses.");

    const pageAll = async <T>(
      table: "letters" | "digital_files" | "scan_transcriptions",
      columns: string,
    ): Promise<T[]> => {
      const out: T[] = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select(columns)
          .order("id")
          .range(from, from + size - 1);
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as unknown as T[];
        out.push(...rows);
        if (rows.length < size) break;
      }
      return out;
    };

    type L = { id: string; scan_status: string | null; transcription_status: string | null };
    type F = { letter_id: string | null };
    type T = {
      letter_id: string | null;
      status: string | null;
      ai_text: string | null;
      verified_text: string | null;
    };

    const [letters, files, trans] = await Promise.all([
      pageAll<L>("letters", "id, scan_status, transcription_status"),
      pageAll<F>("digital_files", "letter_id"),
      pageAll<T>("scan_transcriptions", "letter_id, status, ai_text, verified_text"),
    ]);

    const fileCount = new Map<string, number>();
    for (const f of files) {
      if (!f.letter_id) continue;
      fileCount.set(f.letter_id, (fileCount.get(f.letter_id) ?? 0) + 1);
    }

    type Agg = { total: number; verified: number; withText: number; failed: number };
    const tAgg = new Map<string, Agg>();
    for (const t of trans) {
      if (!t.letter_id) continue;
      const a = tAgg.get(t.letter_id) ?? { total: 0, verified: 0, withText: 0, failed: 0 };
      a.total++;
      if (t.status === "human_verified") a.verified++;
      if (t.status === "failed") a.failed++;
      if ((t.verified_text ?? "").trim() || (t.ai_text ?? "").trim()) a.withText++;
      tAgg.set(t.letter_id, a);
    }

    let updated = 0;
    const changes: { id: string; scan_status?: string; transcription_status?: string }[] = [];

    for (const l of letters) {
      const files = fileCount.get(l.id) ?? 0;
      const patch: { scan_status?: string; transcription_status?: string } = {};

      const scan = files > 0 ? "scanned" : "not_scanned";
      if (l.scan_status !== scan) patch.scan_status = scan;

      if (l.transcription_status !== "not_required") {
        const a = tAgg.get(l.id);
        let ts: string;
        if (!a || a.total === 0) ts = "pending";
        else if (a.failed > 0 && a.withText === 0) ts = "failed";
        else if (a.verified > 0 && a.verified === a.total) ts = "human_verified";
        else if (a.withText > 0) ts = "ai_transcribed";
        else ts = "pending";
        if (l.transcription_status !== ts) patch.transcription_status = ts;
      }

      if (Object.keys(patch).length) changes.push({ id: l.id, ...patch });
    }

    for (const c of changes) {
      const { id, ...patch } = c;
      const { error } = await supabaseAdmin.from("letters").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      updated++;
    }

    return { checked: letters.length, updated };
  });
