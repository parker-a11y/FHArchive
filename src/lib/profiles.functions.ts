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

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        email: (context.claims?.email as string) ?? "",
        status: "pending",
      });
      if (profileError) throw profileError;
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
