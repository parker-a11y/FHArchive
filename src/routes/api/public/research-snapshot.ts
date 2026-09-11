import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Nightly Research Snapshot (2:00 AM America/New_York), called by the scheduler. */
export const Route = createFileRoute("/api/public/research-snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { runResearchSnapshot } = await import("@/lib/research/snapshot.server");
        try {
          const result = await runResearchSnapshot("scheduled");

          // The meaning index refreshes right after the word index, so both stay
          // in step. Only passages whose text or metadata changed are re-embedded.
          let embeddings: unknown = null;
          let embedError: string | null = null;
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { rebuildResearchEmbeddings } = await import("@/lib/research/embed.server");
            const stats = await rebuildResearchEmbeddings(supabaseAdmin);
            embeddings = stats;
            if (result.snapshotId) {
              await supabaseAdmin
                .from("research_snapshots")
                .update({
                  chunks_indexed: stats.chunks,
                  chunks_embedded: stats.embedded,
                  embed_error: null,
                } as never)
                .eq("id", result.snapshotId);
            }
          } catch (e) {
            embedError = e instanceof Error ? e.message : String(e);
            console.error("Nightly meaning-index refresh failed:", embedError);
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              if (result.snapshotId) {
                await supabaseAdmin
                  .from("research_snapshots")
                  .update({ embed_error: embedError } as never)
                  .eq("id", result.snapshotId);
              }
            } catch {
              /* reporting only */
            }
          }

          return Response.json(
            { ...result, embeddings, embed_error: embedError },
            { status: result.status === "error" ? 500 : 200 },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Nightly research snapshot failed:", message);
          return Response.json({ status: "error", error: message }, { status: 500 });
        }
      },
    },
  },
});
