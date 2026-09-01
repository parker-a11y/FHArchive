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
          return Response.json(result, { status: result.status === "error" ? 500 : 200 });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Nightly research snapshot failed:", message);
          return Response.json({ status: "error", error: message }, { status: 500 });
        }
      },
    },
  },
});
