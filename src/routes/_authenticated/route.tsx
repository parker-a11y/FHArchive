import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, isPendingGuest, signOut } = useAuthWithSignOut();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (isPendingGuest) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Account request pending</h1>
          <p className="text-muted-foreground">
            Your account has been created as a guest. An administrator must approve it before you
            can view the archive.
          </p>
          <Button onClick={signOut} variant="outline">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

function useAuthWithSignOut() {
  const auth = useAuth();
  async function signOut() {
    await supabase.auth.signOut();
  }
  return { ...auth, signOut };
}
