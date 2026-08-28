import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Harrington Letter Archive" },
      {
        name: "description",
        content: "Private sign-in for the Harrington Letter Archive cataloging workspace.",
      },
      { property: "og:title", content: "Sign In — Harrington Letter Archive" },
      {
        property: "og:description",
        content: "Private sign-in for the Harrington Letter Archive cataloging workspace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fn =
      mode === "in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    const { error } = await fn;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "in" ? "Signed in" : "Account created");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold">Harrington Letter Archive</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Private archival workspace. Sign in to continue.
        </p>
        <form onSubmit={submit} className="space-y-4 rounded border border-border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "in" ? "Sign in" : "Create account"}
          </Button>
          {mode === "in" && (
            <Link
              to="/forgot-password"
              className="block text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          )}
          <button
            type="button"
            className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "Create the archive account" : "I already have an account"}
          </button>
        </form>
      </div>
    </div>
  );
}
