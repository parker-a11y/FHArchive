import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Every-minute scheduler: advances queued/running Book Builder PDF exports. */
export const Route = createFileRoute("/api/public/book-exports-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runBookExportTicks } = await import("@/lib/book/export.server");
        try {
          const touched = await runBookExportTicks(supabaseAdmin as any, 40_000);
          return Response.json({ ok: true, touched });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Book export tick failed:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
