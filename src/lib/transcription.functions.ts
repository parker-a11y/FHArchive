import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TranscribeResult = {
  fileId: string;
  ok: boolean;
  error?: string;
  chars?: number;
};

/**
 * Transcribes one or more scans. The archival master is only ever read; the
 * result is stored in scan_transcriptions as raw AI text with status
 * "ai_transcribed" — never auto-verified.
 */
export const transcribeScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileIds: string[] }) => ({
    fileIds: (data.fileIds ?? []).slice(0, 50).map(String),
  }))
  .handler(async ({ data, context }): Promise<TranscribeResult[]> => {
    const { resolveScanTargets, toDataUrl, transcribeImage, TRANSCRIPTION_MODEL, rebuildRecordTranscription } =
      await import("@/lib/transcription.server");
    const supabase = context.supabase;
    const targets = await resolveScanTargets(supabase, data.fileIds);
    const results: TranscribeResult[] = [];

    for (const [i, t] of targets.entries()) {
      await supabase.from("scan_transcriptions").upsert(
        {
          letter_id: t.letterId,
          file_id: t.fileId,
          page_label: t.label,
          page_index: t.sortOrder,
          status: "processing",
          error: null,
          owner_id: context.userId,
        } as never,
        { onConflict: "file_id" },
      );

      try {
        const urls = await Promise.all(
          (t.paths?.length ? t.paths : [t.path]).map((p) => toDataUrl(supabase, p, t.mime)),
        );
        const text = await transcribeImage(urls, `Page ${i + 1}${t.label ? ` — ${t.label}` : ""}`);
        await supabase
          .from("scan_transcriptions")
          .update({
            ai_text: text,
            status: "ai_transcribed",
            model: TRANSCRIPTION_MODEL,
            error: null,
            ai_generated_at: new Date().toISOString(),
          } as never)
          .eq("file_id", t.fileId);
        results.push({ fileId: t.fileId, ok: true, chars: text.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Transcription failed";
        await supabase
          .from("scan_transcriptions")
          .update({ status: "failed", error: message } as never)
          .eq("file_id", t.fileId);
        results.push({ fileId: t.fileId, ok: false, error: message });
      }
    }

    for (const letterId of new Set(targets.map((t) => t.letterId))) {
      await rebuildRecordTranscription(supabase, letterId);
    }

    const missing = data.fileIds.filter((id) => !targets.some((t) => t.fileId === id));
    for (const id of missing) {
      results.push({ fileId: id, ok: false, error: "No web-viewable copy available for this scan" });
    }
    return results;
  });

/**
 * Transcribes every page of one FH record in scan order and assembles a
 * combined record-level transcription from the non-envelope pages.
 */
export const transcribeRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { letterId: string; force?: boolean }) => ({
    letterId: String(data.letterId),
    force: Boolean(data.force),
  }))
  .handler(async ({ data, context }) => {
    const {
      resolveScanTargets,
      toDataUrl,
      transcribeImage,
      isEnvelope,
      TRANSCRIPTION_MODEL,
    } = await import("@/lib/transcription.server");
    const supabase = context.supabase;

    const { data: files } = await supabase
      .from("digital_files")
      .select("id, include_in_transcription")
      .eq("letter_id", data.letterId)
      .order("sort_order", { ascending: true });
    const ids = (files ?? []).map((f) => f.id);
    const targets = await resolveScanTargets(supabase, ids);
    if (!targets.length) return { pages: 0, failed: 0, error: "No web-viewable scans on record" };

    const { data: existing } = await supabase
      .from("scan_transcriptions")
      .select("file_id, ai_text, verified_text, status")
      .eq("letter_id", data.letterId);

    let failed = 0;
    const pages: { fileId: string; label: string | null; text: string }[] = [];

    for (const [i, t] of targets.entries()) {
      const prior = (existing ?? []).find((e) => e.file_id === t.fileId);
      const priorText = prior?.verified_text?.trim() || prior?.ai_text?.trim() || "";
      if (!data.force && priorText) {
        pages.push({ fileId: t.fileId, label: t.label, text: priorText });
        continue;
      }

      await supabase.from("scan_transcriptions").upsert(
        {
          letter_id: t.letterId,
          file_id: t.fileId,
          page_label: t.label,
          page_index: t.sortOrder,
          status: "processing",
          error: null,
          owner_id: context.userId,
        } as never,
        { onConflict: "file_id" },
      );

      try {
        const urls = await Promise.all(
          (t.paths?.length ? t.paths : [t.path]).map((p) => toDataUrl(supabase, p, t.mime)),
        );
        const text = await transcribeImage(urls, `Page ${i + 1}${t.label ? ` — ${t.label}` : ""}`);
        await supabase
          .from("scan_transcriptions")
          .update({
            ai_text: text,
            status: "ai_transcribed",
            model: TRANSCRIPTION_MODEL,
            error: null,
            ai_generated_at: new Date().toISOString(),
          } as never)
          .eq("file_id", t.fileId);
        pages.push({ fileId: t.fileId, label: t.label, text });
      } catch (e) {
        failed += 1;
        const message = e instanceof Error ? e.message : "Transcription failed";
        await supabase
          .from("scan_transcriptions")
          .update({ status: "failed", error: message } as never)
          .eq("file_id", t.fileId);
      }
    }

    // Envelope text stays out of the combined letter body, unless that scan was
    // explicitly added to the transcription from the scans page.
    const included = new Set(
      (files ?? []).filter((f: any) => f.include_in_transcription).map((f: any) => f.id as string),
    );
    const { combineTranscriptionPages } = await import("@/lib/transcription-format");
    const body = combineTranscriptionPages(
      pages
        .filter((p) => !isEnvelope(p.label) || included.has(p.fileId))
        .map((p) => p.text),
    );

    if (body.trim()) {
      await supabase
        .from("letters")
        .update({
          transcription_raw_ai: body,
          transcription_status: "ai_transcribed",
          transcription_ai_generated_at: new Date().toISOString(),
        } as never)
        .eq("id", data.letterId);
    }

    return { pages: pages.length, failed, error: null as string | null };
  });

/**
 * Rebuilds one record's combined transcription from its page transcriptions.
 * Called after page text changes so shared links and emails stay current.
 */
export const rollupRecordTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { letterId: string; force?: boolean }) => ({
    letterId: String(data.letterId),
    force: Boolean(data.force),
  }))
  .handler(async ({ data, context }) => {
    const { rebuildRecordTranscription } = await import("@/lib/transcription.server");
    return rebuildRecordTranscription(context.supabase, data.letterId, data.force);
  });

/** Records whose combined transcription has drifted from their page text. */
export const checkStaleTranscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { letterIds: string[] }) => ({
    letterIds: (data.letterIds ?? []).map(String),
  }))
  .handler(async ({ data, context }) => {
    const { staleRecordTranscriptions } = await import("@/lib/transcription.server");
    return staleRecordTranscriptions(context.supabase, data.letterIds);
  });

/**
 * Adds one scan to (or removes it from) the record transcription. Used on the
 * scans page for envelopes, which are otherwise never transcribed. Adding a
 * scan transcribes it if it has no text yet; removing keeps the page text but
 * drops it out of the combined record transcription.
 */
export const setScanIncludedInTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileId: string; include: boolean }) => ({
    fileId: String(data.fileId),
    include: Boolean(data.include),
  }))
  .handler(async ({ data, context }) => {
    const { resolveScanTargets, toDataUrl, transcribeImage, TRANSCRIPTION_MODEL, rebuildRecordTranscription } =
      await import("@/lib/transcription.server");
    const supabase = context.supabase;

    const { data: file, error: fileError } = await supabase
      .from("digital_files")
      .select("id, letter_id, label, sort_order")
      .eq("id", data.fileId)
      .maybeSingle();
    if (fileError || !file) throw new Error(fileError?.message ?? "Scan not found");

    const { error: flagError } = await supabase
      .from("digital_files")
      .update({ include_in_transcription: data.include } as never)
      .eq("id", data.fileId);
    if (flagError) throw new Error(flagError.message);

    let transcribed = false;
    let error: string | null = null;

    if (data.include) {
      const { data: existing } = await supabase
        .from("scan_transcriptions")
        .select("ai_text, verified_text")
        .eq("file_id", data.fileId)
        .maybeSingle();
      const hasText = Boolean(
        (existing as any)?.verified_text?.trim() || (existing as any)?.ai_text?.trim(),
      );

      if (!hasText) {
        const [target] = await resolveScanTargets(supabase, [data.fileId]);
        if (!target) {
          error = "No web-viewable copy available for this scan";
        } else {
          await supabase.from("scan_transcriptions").upsert(
            {
              letter_id: target.letterId,
              file_id: target.fileId,
              page_label: target.label,
              page_index: target.sortOrder,
              status: "processing",
              error: null,
              owner_id: context.userId,
            } as never,
            { onConflict: "file_id" },
          );
          try {
            const urls = await Promise.all(
              (target.paths?.length ? target.paths : [target.path]).map((p) =>
                toDataUrl(supabase, p, target.mime),
              ),
            );
            const text = await transcribeImage(urls, target.label ?? "Scan");
            await supabase
              .from("scan_transcriptions")
              .update({
                ai_text: text,
                status: "ai_transcribed",
                model: TRANSCRIPTION_MODEL,
                error: null,
                ai_generated_at: new Date().toISOString(),
              } as never)
              .eq("file_id", target.fileId);
            transcribed = true;
          } catch (e) {
            error = e instanceof Error ? e.message : "Transcription failed";
            await supabase
              .from("scan_transcriptions")
              .update({ status: "failed", error } as never)
              .eq("file_id", target.fileId);
          }
        }
      }
    }

    await rebuildRecordTranscription(supabase, (file as any).letter_id as string);
    return { include: data.include, transcribed, error };
  });
