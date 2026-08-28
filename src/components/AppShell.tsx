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
  BookOpen,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/catalog", label: "Quick Entry", icon: PlusSquare },
  { to: "/letters", label: "All Records", icon: Files },
  { to: "/sources", label: "Digital Sources", icon: Globe },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/search", label: "Search", icon: Search },
  { to: "/queues", label: "Work Queues", icon: ListChecks },
  { to: "/people", label: "People", icon: Users },
  { to: "/organizations", label: "Orgs & Ships", icon: Ship },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/places", label: "Places", icon: MapPin },
  { to: "/keywords", label: "Keywords", icon: Tags },
  { to: "/backups", label: "Backups", icon: ShieldCheck },
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
      <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-archive-gold-strong text-sidebar-accent-foreground shadow-lg">
            <BookOpen className="size-5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-display text-lg leading-none font-semibold text-sidebar-accent-foreground">
              Harrington
            </span>
            <span className="mt-1 text-[10px] font-bold tracking-[0.2em] text-sidebar-foreground/60 uppercase">
              Family Archive
            </span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon
                  className={`size-4 transition-colors ${
                    active
                      ? "text-archive-gold"
                      : "text-sidebar-foreground/50 group-hover:text-archive-gold"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
    <div className="no-print flex items-end justify-between gap-4 border-b border-border px-4 sm:px-8 py-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}
