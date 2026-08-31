import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/archivist-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { sendArchivistDigest } = await import("@/lib/archivist-digest.server");
        try {
          const result = await sendArchivistDigest(24);
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Archivist digest failed:", message);
          return Response.json({ status: "error", error: message }, { status: 500 });
        }
      },
    },
  },
});
