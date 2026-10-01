import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const PROOF_TO = "parkerjh@gmail.com";
const TZ = "America/New_York";

const nyDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const nyHour = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(d));

/** At 9pm New York time, emails a proof of every email scheduled for tomorrow. */
export const Route = createFileRoute("/api/public/email-proofs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const now = new Date();
        const force = new URL(request.url).searchParams.get("force") === "1";
        // Cron fires at 01:00 and 02:00 UTC to cover daylight saving; only act at 9pm NY.
        if (!force && nyHour(now) !== 21) return Response.json({ skipped: "not 9pm in New York" });

        const tomorrow = nyDate(new Date(now.getTime() + 24 * 3600_000));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { deliverArchiveEmail } = await import("@/lib/archive-email-send.server");
        const db = supabaseAdmin as any;
        const { data: rows, error } = await db
          .from("archive_emails")
          .select("id, owner_id, send_payload, scheduled_for")
          .eq("status", "scheduled")
          .gte("scheduled_for", now.toISOString())
          .lte("scheduled_for", new Date(now.getTime() + 40 * 3600_000).toISOString());
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const due = (rows ?? []).filter((r: any) => r.send_payload && nyDate(new Date(r.scheduled_for)) === tomorrow);
        const results: { id: string; ok: boolean; error?: string }[] = [];
        for (const row of due) {
          try {
            await deliverArchiveEmail(db, row.owner_id, row.send_payload, row.id, {
              proofTo: PROOF_TO,
              proofKey: `${row.id}-${tomorrow}-${row.scheduled_for}`,
            });
            results.push({ id: row.id, ok: true });
          } catch (e) {
            results.push({ id: row.id, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return Response.json({ tomorrow, proofs: results.length, results });
      },
    },
  },
});
