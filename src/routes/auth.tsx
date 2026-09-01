import logoMark from "@/assets/francis-files-logo.png";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Only same-origin relative paths may be used as a post-login redirect. */
function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => {
    const next = safeNext(s["next"]);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign In — The Francis Files" },
      {
        name: "description",
        content: "Private sign-in for The Francis Files cataloging workspace.",
      },
      { property: "og:title", content: "Sign In — The Francis Files" },
      {
        property: "og:description",
        content: "Private sign-in for The Francis Files cataloging workspace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch() as { next?: string };
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signUpMessage, setSignUpMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    if (next) {
      window.location.replace(next);
      return;
    }
    navigate({ to: "/" });
  }, [session, navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSignUpMessage(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Signed in");
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSignUpMessage(
      "Account request received. Please confirm your email if required, then wait for an administrator to approve guest access."
    );
  }

  async function signInWithGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      return toast.error(result.error.message ?? "Google sign-in failed");
    }
    if (result.redirected) return;
    setBusy(false);
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10 lg:flex-row lg:gap-16">
      <div className="flex max-w-md flex-col items-center text-center lg:max-w-lg lg:items-start lg:text-left">
        <img
          src={logoMark}
          alt="The Francis Files"
          width={1024}
          height={1024}
          className="size-48 object-contain lg:size-80"
        />
        <h1 className="font-display mt-4 text-3xl font-semibold lg:text-4xl">The Francis Files</h1>
        <p className="mt-2 max-w-sm text-base text-muted-foreground lg:text-lg">
          Private archival workspace for cataloging, digitizing, and researching the Francis Harrington collection.
        </p>
      </div>
      <div className="w-full max-w-sm">
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
            {mode === "in" ? "Sign in" : "Request account"}
          </Button>
          {signUpMessage && (
            <p className="rounded bg-muted p-2 text-center text-xs text-muted-foreground">
              {signUpMessage}
            </p>
          )}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={busy}
            onClick={signInWithGoogle}
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.6c-.1 1.1-.9 2.8-2.5 3.9l-.02.15 3.6 2.8.25.03c2.3-2.1 3.6-5.2 3.6-8.8Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6-1.1 8-2.9l-3.8-3c-1 .7-2.4 1.2-4.2 1.2a7.3 7.3 0 0 1-6.9-5l-.14.01-3.7 2.9-.05.14A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.1 14.3a7.4 7.4 0 0 1 0-4.6l-.01-.15-3.75-2.9-.12.06a12 12 0 0 0 0 10.6l3.88-3Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.7c2.1 0 3.5.9 4.3 1.7l3.2-3.1C17.9 1.4 15.3 0 12 0 7.3 0 3.2 2.7 1.2 6.7l3.9 3a7.3 7.3 0 0 1 6.9-5Z"
              />
            </svg>
            Continue with Google
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
            {mode === "in" ? "Request New Account" : "I already have an account"}
          </button>
        </form>
      </div>
    </div>
  );
}
