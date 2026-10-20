import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        // Optional body {"filesOnly": true}: catch-up mode that mirrors storage
        // files only, without producing another database dump.
        let filesOnly = false;
        try {
          const body = (await request.json()) as { filesOnly?: boolean };
          filesOnly = body?.filesOnly === true;
        } catch {
          // Empty body is fine — full backup mode.
        }

        const { runBackup } = await import("@/lib/backup.server");
        try {
          const result = await runBackup({ filesOnly });
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Nightly backup failed:", message);
          return Response.json({ status: "error", error: message }, { status: 500 });
        }
      },
    },
  },
});
