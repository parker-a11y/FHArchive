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

/** Apply plain-language additions to an existing recap without regenerating it. */
export const refineWeeklyRecapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { weekStart: string; instructions: string }) => {
    const weekStart = String(data?.weekStart ?? "");
    const instructions = String(data?.instructions ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error("Invalid week.");
    if (instructions.length < 3) throw new Error("Tell the AI what to add or change.");
    return { weekStart, instructions: instructions.slice(0, 4000) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { refineWeeklyRecap } = await import("@/lib/recaps/weekly.server");
    return refineWeeklyRecap(data.weekStart, data.instructions);
  });

/**
 * Emails a recap after review. Recaps are never sent automatically — an
 * administrator triggers this from the recap page whenever they choose.
 */
export const emailWeeklyRecapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      weekStart: string;
      recipients: { email: string; name?: string | null }[];
      message?: string;
    }) => {
      const weekStart = String(data?.weekStart ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error("Invalid week.");
      const recipients = (data?.recipients ?? [])
        .slice(0, 25)
        .map((r) => ({ email: String(r.email).trim().toLowerCase(), name: r.name ?? null }))
        .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email));
      if (recipients.length === 0) throw new Error("Add at least one valid email address.");
      return { weekStart, recipients, message: String(data?.message ?? "").slice(0, 4000) };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sendRecapEmail } = await import("@/lib/recaps/email.server");
    return sendRecapEmail(
      context.supabase,
      context.userId,
      data.weekStart,
      data.recipients,
      data.message,
    );
  });
