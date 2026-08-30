import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ensurePendingGuestProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, status")
      .eq("id", userId)
      .maybeSingle();

    const guestEmail = (context.claims?.['email'] as string) ?? "";

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        email: guestEmail,
        status: "pending",
      });
      if (profileError) throw profileError;

      // Notify admins that a new guest account is awaiting approval.
      try {
        const { data: adminRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const adminIds = (adminRoles ?? []).map((r) => r.user_id);
        if (adminIds.length) {
          const { data: adminProfiles } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .in("id", adminIds);
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          for (const admin of adminProfiles ?? []) {
            if (!admin.email) continue;
            await sendTemplateEmail("guest-request", admin.email, {
              idempotencyKey: `guest-request-${userId}`,
              templateData: {
                guestEmail,
                requestedAt: new Date().toUTCString(),
                approveUrl: "https://fharchive.com/admin/users",
              },
            });
          }
        }
      } catch (notifyError) {
        console.error("Failed to notify admins of guest request:", notifyError);
      }
    }


    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "guest")
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "guest",
      });
      if (roleError) throw roleError;
    }

    return { ok: true };
  });

export const getMyArchiveAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: isAdmin }, { data: isApprovedGuest }] = await Promise.all([
      supabase.rpc("is_admin", { _user_id: userId }),
      supabase.rpc("is_approved_guest", { _user_id: userId }),
    ]);

    return {
      isAdmin: !!isAdmin,
      isApprovedGuest: !!isApprovedGuest,
      canReadArchive: !!isAdmin || !!isApprovedGuest,
    };
  });

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, note, status, approved_at, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) throw rolesError;

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }

    return {
      profiles: (profiles ?? []).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    };
  });

export const updateProfileStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; status: "approved" | "pending" }) => input)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.userId === userId) throw new Error("You cannot change your own status");

    const { error } = await supabase
      .from("profiles")
      .update({
        status: data.status,
        approved_at: data.status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", data.userId);

    if (error) throw error;

    // Notify the guest when their account is approved.
    if (data.status === "approved") {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: approvedProfile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("id", data.userId)
          .maybeSingle();
        if (approvedProfile?.email) {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await sendTemplateEmail("guest-approved", approvedProfile.email, {
            idempotencyKey: `guest-approved-${data.userId}`,
            templateData: {
              guestName: approvedProfile.full_name,
              archiveUrl: "https://fharchive.com",
            },
          });
        }
      } catch (notifyError) {
        console.error("Failed to notify guest of approval:", notifyError);
      }
    }

    return { ok: true };
  });

export const deleteGuestAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.userId === userId) throw new Error("You cannot delete your own account");

    const { error: rolesError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (rolesError) throw rolesError;

    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", data.userId);
    if (profileError) throw profileError;

    return { ok: true };
  });
