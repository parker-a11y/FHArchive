import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Sends archive emails whose scheduled time has arrived. */
export const Route = createFileRoute("/api/public/scheduled-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { deliverArchiveEmail } = await import("@/lib/archive-email-send.server");
        const db = supabaseAdmin as any;
        const { data: due, error } = await db
          .from("archive_emails")
          .select("id, owner_id, send_payload")
          .eq("status", "scheduled")
          .lte("scheduled_for", new Date().toISOString())
          .limit(10);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const results: { id: string; ok: boolean; error?: string }[] = [];
        for (const row of due ?? []) {
          // Claim the row so overlapping runs never double-send.
          const { data: claimed } = await db
            .from("archive_emails")
            .update({ status: "sending" })
            .eq("id", row.id)
            .eq("status", "scheduled")
            .select("id");
          if (!claimed?.length) continue;
          try {
            await deliverArchiveEmail(db, row.owner_id, row.send_payload, row.id);
            results.push({ id: row.id, ok: true });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await db.from("archive_emails").update({ status: "failed", error: message }).eq("id", row.id);
            results.push({ id: row.id, ok: false, error: message });
          }
        }
        return Response.json({ processed: results.length, results });
      },
    },
  },
});
