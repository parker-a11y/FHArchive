import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Only an administrator can do that.");
  return true;
}

/** Anyone with archive access — admins, archivists and view-only guests. */
async function assertArchiveAccess(context: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: canRead }, { data: canEdit }] = await Promise.all([
    supabaseAdmin.rpc("can_read_archive", { _user_id: context.userId }),
    supabaseAdmin.rpc("can_edit_archive", { _user_id: context.userId }),
  ]);
  if (!canRead && !canEdit) throw new Error("You do not have access to the archive.");
}

/**
 * "Generate Weekly Recap now". Any approved account may generate the recap for
 * a week that has none; replacing an existing week's recap stays with admins.
 */
export const generateWeeklyRecap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { weekStart?: string; mode?: "current" | "scheduled" } | undefined) => ({
    weekStart: data?.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(data.weekStart) ? data.weekStart : undefined,
    mode: data?.mode === "scheduled" ? ("scheduled" as const) : ("current" as const),
  }))
  .handler(async ({ data, context }) => {
    await assertArchiveAccess(context);
    if (data.weekStart) {
      await assertAdmin(context);
      return (await import("@/lib/recaps/weekly.server")).runWeeklyRecap("week", {
        weekStart: data.weekStart,
      });
    }
    const { runWeeklyRecap } = await import("@/lib/recaps/weekly.server");
    return runWeeklyRecap(data.mode);
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
      publicLinks?: boolean;
      includeTranscription?: boolean;
    }) => {
      const weekStart = String(data?.weekStart ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error("Invalid week.");
      const recipients = (data?.recipients ?? [])
        .slice(0, 25)
        .map((r) => ({ email: String(r.email).trim().toLowerCase(), name: r.name ?? null }))
        .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email));
      if (recipients.length === 0) throw new Error("Add at least one valid email address.");
      return {
        weekStart,
        recipients,
        message: String(data?.message ?? "").slice(0, 4000),
        publicLinks: data?.publicLinks !== false,
        includeTranscription: data?.includeTranscription === true,
      };
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
      { publicLinks: data.publicLinks, includeTranscription: data.includeTranscription },
    );
  });
