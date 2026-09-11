import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Incremental re-index. Runs every few minutes: when a record or transcription
 * has changed, the searchable word index is refreshed and only the changed
 * passages are re-embedded, so an edit becomes findable by meaning within
 * minutes instead of waiting for the nightly rebuild.
 *
 * Safeguards: a single-flight lease (no two runs at once), a bounded queue
 * claim per run, and a paused state that halts the job when the AI service
 * refuses the work (out of credits or blocked).
 */
const LEASE_MINUTES = 15;
const MAX_QUEUE_CLAIM = 2000;

export const Route = createFileRoute("/api/public/research-reindex")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();

        const { data: state } = await supabaseAdmin
          .from("reindex_state")
          .select("lease_until, last_result")
          .eq("id", true)
          .maybeSingle();

        const last = (state?.last_result ?? {}) as Record<string, unknown>;
        if (last["paused"]) {
          return Response.json({ status: "paused", reason: last["error"] ?? null });
        }
        if (state?.lease_until && new Date(state.lease_until) > now) {
          return Response.json({ status: "busy" });
        }

        // Nothing changed → do no work at all.
        const { data: queued } = await supabaseAdmin
          .from("reindex_queue")
          .select("id")
          .order("marked_at")
          .limit(MAX_QUEUE_CLAIM);
        const ids = (queued ?? []).map((r: { id: string }) => r.id);
        if (!ids.length) return Response.json({ status: "idle", pending: 0 });

        const leaseUntil = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();
        await supabaseAdmin
          .from("reindex_state")
          .upsert({ id: true, lease_until: leaseUntil, last_run_at: now.toISOString() } as never);

        try {
          const { refreshResearchIndexOnly } = await import("@/lib/research/snapshot.server");
          const { rebuildResearchEmbeddings } = await import("@/lib/research/embed.server");

          const index = await refreshResearchIndexOnly();
          const embeddings = await rebuildResearchEmbeddings(supabaseAdmin);

          // Only clear what this run claimed: anything marked meanwhile stays queued.
          await supabaseAdmin.from("reindex_queue").delete().in("id", ids);

          const result = { claimed: ids.length, index, embeddings, at: new Date().toISOString() };
          await supabaseAdmin
            .from("reindex_state")
            .upsert({ id: true, lease_until: null, last_result: result } as never);
          return Response.json({ status: "ok", ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Credit exhaustion or a blocked AI service stops the job rather than
          // retrying every few minutes; a transient failure just retries next run.
          const paused = /\b(402|403)\b|credit|blocked|disabled/i.test(message);
          await supabaseAdmin.from("reindex_state").upsert({
            id: true,
            lease_until: null,
            last_result: { error: message, paused, at: new Date().toISOString() },
          } as never);
          console.error("Incremental re-index failed:", message);
          return Response.json({ status: "error", error: message, paused }, { status: 500 });
        }
      },
    },
  },
});
