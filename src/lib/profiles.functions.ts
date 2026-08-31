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

    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("status").eq("id", userId).maybeSingle(),
    ]);

    const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
    const approved = profile?.status === "approved";
    const isAdmin = roleSet.has("admin");
    const isArchivist = !isAdmin && roleSet.has("archivist") && approved;
    const isApprovedGuest = !isAdmin && !isArchivist && roleSet.has("guest") && approved;

    return {
      isAdmin,
      isApprovedGuest,
      isArchivist,
      canReadArchive: isAdmin || isApprovedGuest || isArchivist,
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

/** Admin-only: switch an account between guest (view-only) and archivist (editor). */
export const setAccountRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "guest" | "archivist" }) => input)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.userId === userId) throw new Error("You cannot change your own role");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", data.userId);
    if ((roles ?? []).some((r) => r.role === "admin")) {
      throw new Error("Administrator accounts cannot be changed here");
    }

    const { error: delError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["guest", "archivist"]);
    if (delError) throw delError;

    const { error: insError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insError) throw insError;

    if (data.role === "archivist") {
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("id", data.userId)
          .maybeSingle();
        if (profile?.email) {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await sendTemplateEmail("archivist-granted", profile.email, {
            idempotencyKey: `archivist-granted-${data.userId}-${Date.now()}`,
            templateData: {
              guestName: profile.full_name,
              archiveUrl: "https://fharchive.com",
            },
          });
        }
      } catch (notifyError) {
        console.error("Failed to notify new archivist:", notifyError);
      }
    }

    return { ok: true };
  });

/** Admin-only: create a new archive account directly from Account Control. */
export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      fullName?: string;
      role: "guest" | "archivist";
      password?: string;
    }) => {
      const email = input.email?.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address");
      }
      if (input.password && input.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      return {
        email,
        fullName: input.fullName?.trim() || null,
        role: input.role === "archivist" ? ("archivist" as const) : ("guest" as const),
        password: input.password || null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const generated =
      data.password ??
      `FF-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: generated,
      email_confirm: true,
      user_metadata: data.fullName ? { full_name: data.fullName } : undefined,
    });

    if (createError || !created?.user) {
      const msg = createError?.message ?? "Could not create the account";
      throw new Error(
        /already/i.test(msg) ? "An account with that email already exists" : msg,
      );
    }

    const newUserId = created.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: newUserId,
        email: data.email,
        full_name: data.fullName,
        status: "approved",
        approved_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleError) throw roleError;

    if (data.role === "archivist") {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await sendTemplateEmail("archivist-granted", data.email, {
          idempotencyKey: `archivist-granted-${newUserId}`,
          templateData: {
            guestName: data.fullName,
            archiveUrl: "https://fharchive.com",
          },
        });
      } catch (notifyError) {
        console.error("Failed to notify new archivist:", notifyError);
      }
    }

    return { ok: true, userId: newUserId, email: data.email, password: generated };
  });
