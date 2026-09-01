import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Only an administrator can generate Weekly Recaps.");
}

/** "Generate Weekly Recap now" / regenerate a past week — admins only. */
export const generateWeeklyRecap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { weekStart?: string; mode?: "current" | "scheduled" } | undefined) => ({
    weekStart: data?.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(data.weekStart) ? data.weekStart : undefined,
    mode: data?.mode === "scheduled" ? ("scheduled" as const) : ("current" as const),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { runWeeklyRecap } = await import("@/lib/recaps/weekly.server");
    return data.weekStart
      ? runWeeklyRecap("week", { weekStart: data.weekStart })
      : runWeeklyRecap(data.mode);
  });
