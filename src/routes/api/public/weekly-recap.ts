import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Weekly Francis Files Recap (Sundays, 2:00 AM America/New_York), run by the scheduler. */
export const Route = createFileRoute("/api/public/weekly-recap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { runWeeklyRecap } = await import("@/lib/recaps/weekly.server");
        try {
          const result = await runWeeklyRecap("scheduled");
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Weekly recap failed:", message);
          return Response.json({ status: "error", error: message }, { status: 500 });
        }
      },
    },
  },
});
