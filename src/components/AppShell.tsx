import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Files,
  PlusSquare,
  Clock,
  Search,
  Users,
  MapPin,
  Tags,
  ListChecks,
  LogOut,
  Ship,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/catalog", label: "Quick Entry", icon: PlusSquare },
  { to: "/letters", label: "All Records", icon: Files },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/search", label: "Search", icon: Search },
  { to: "/queues", label: "Work Queues", icon: ListChecks },
  { to: "/people", label: "People", icon: Users },
  { to: "/organizations", label: "Orgs & Ships", icon: Ship },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/places", label: "Places", icon: MapPin },
  { to: "/keywords", label: "Keywords", icon: Tags },
];


export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Opening archive…
      </div>
    );
  if (!session) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="border-b border-sidebar-border px-4 py-4">
          <div className="font-display text-sm leading-tight font-semibold text-sidebar-foreground">
            Harrington
            <br />
            Family Archive
          </div>

          <div className="field-label mt-1">Private workspace</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`mb-0.5 flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print flex items-end justify-between gap-4 border-b border-border px-8 py-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}
