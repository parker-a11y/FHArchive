import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Slowly writes "What was happening this day" for every archive date.
 * Runs hourly and handles only a few dates per run, so the AI service is
 * never hammered; it exits immediately once the waiting list is empty.
 */
const BATCH = 3;

export const Route = createFileRoute("/api/public/on-this-date-backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runDateContextBackfill } = await import("@/lib/on-this-date.server");
        try {
          const result = await runDateContextBackfill(supabaseAdmin, BATCH);
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("On This Date backfill failed:", message);
          return Response.json({ status: "error", error: message }, { status: 500 });
        }
      },
    },
  },
});
