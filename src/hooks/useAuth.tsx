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
  isPendingGuest: boolean;
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
  isPendingGuest: false,
  isGuestViewer: false,
  canReadArchive: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState({
    isAdmin: false,
    isApprovedGuest: false,
    isPendingGuest: false,
    canReadArchive: false,
  });

  useEffect(() => {
    async function refreshAccess(s: Session | null) {
      if (!s?.user) {
        setAccess({
          isAdmin: false,
          isApprovedGuest: false,
          isPendingGuest: false,
          canReadArchive: false,
        });
        return;
      }
      try {
        await ensurePendingGuestProfile();
        const result = await getMyArchiveAccess();
        setAccess({
          isAdmin: result.isAdmin,
          isApprovedGuest: result.isApprovedGuest,
          isPendingGuest: !result.isAdmin && !result.isApprovedGuest,
          canReadArchive: result.canReadArchive,
        });
      } catch (error) {
        console.error("Failed to refresh archive access:", error);
        setAccess({
          isAdmin: false,
          isApprovedGuest: false,
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
        isGuestViewer: access.isApprovedGuest && !access.isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
