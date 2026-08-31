import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensurePendingGuestProfile, getMyArchiveAccess } from "@/lib/profiles.functions";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isApprovedGuest: boolean;
  isArchivist: boolean;
  isPendingGuest: boolean;
  /** Admin or approved archivist — may edit archive content. */
  canEdit: boolean;
  /** Approved guest without admin rights — view-only experience. */
  isGuestViewer: boolean;
  canReadArchive: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  isApprovedGuest: false,
  isArchivist: false,
  isPendingGuest: false,
  canEdit: false,
  isGuestViewer: false,
  canReadArchive: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState({
    isAdmin: false,
    isApprovedGuest: false,
    isArchivist: false,
    isPendingGuest: false,
    canReadArchive: false,
  });

  useEffect(() => {
    async function refreshAccess(s: Session | null) {
      if (!s?.user) {
        setAccess({
          isAdmin: false,
          isApprovedGuest: false,
          isArchivist: false,
          isPendingGuest: false,
          canReadArchive: false,
        });
        return;
      }
      try {
        await ensurePendingGuestProfile();
        let result = await getMyArchiveAccess();
        if (!result.isAdmin && !result.isArchivist && !result.isApprovedGuest) {
          // Fallback: read roles directly with the browser client (RLS-scoped).
          const [{ data: roles }, { data: profile }] = await Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", s.user.id),
            supabase.from("profiles").select("status").eq("id", s.user.id).maybeSingle(),
          ]);
          const roleSet = new Set((roles ?? []).map((r) => r.role as string));
          const approved = profile?.status === "approved";
          const admin = roleSet.has("admin");
          const archivist = !admin && roleSet.has("archivist") && approved;
          const guest = !admin && !archivist && roleSet.has("guest") && approved;
          result = {
            isAdmin: admin,
            isArchivist: archivist,
            isApprovedGuest: guest,
            canReadArchive: admin || archivist || guest,
          };
        }
        setAccess({
          isAdmin: result.isAdmin,
          isApprovedGuest: result.isApprovedGuest,
          isArchivist: result.isArchivist,
          isPendingGuest: !result.isAdmin && !result.isApprovedGuest && !result.isArchivist,
          canReadArchive: result.canReadArchive,
        });
      } catch (error) {
        console.error("Failed to refresh archive access:", error);
        setAccess({
          isAdmin: false,
          isApprovedGuest: false,
          isArchivist: false,
          isPendingGuest: true,
          canReadArchive: false,
        });
      }
    }

    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      refreshAccess(d.session).then(() => setLoading(false));
    });

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      refreshAccess(s);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        ...access,
        canEdit: access.isAdmin || access.isArchivist,
        // Read-only viewers: approved guests without editing rights.
        isGuestViewer: access.canReadArchive && !access.isAdmin && !access.isArchivist,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
