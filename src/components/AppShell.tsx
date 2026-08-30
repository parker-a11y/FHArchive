import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
  Box,
  ShieldCheck,
  Mail,
  Menu,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/catalog", label: "Quick Entry", icon: PlusSquare },
  { to: "/letters", label: "All Records", icon: Files },
  { to: "/sources", label: "Digital Sources", icon: Globe },
  { to: "/containers", label: "Source Containers", icon: Box },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/search", label: "Search", icon: Search },
  { to: "/queues", label: "Work Queues", icon: ListChecks },
  { to: "/people", label: "People", icon: Users },
  { to: "/organizations", label: "Orgs & Ships", icon: Ship },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/places", label: "Places", icon: MapPin },
  { to: "/keywords", label: "Keywords", icon: Tags },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/emails", label: "Sent Email", icon: Mail },
  { to: "/backups", label: "Backups", icon: ShieldCheck },
];


export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const nav = (onNavigate?: () => void) => (
    <>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-archive-gold-strong text-sidebar-accent-foreground shadow-lg">
          <BookOpen className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="font-display text-lg leading-none font-semibold text-sidebar-accent-foreground">
            The Francis
          </span>
          <span className="mt-1 text-[10px] font-bold tracking-[0.2em] text-sidebar-foreground/60 uppercase">
            Files
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
              onClick={onNavigate}
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
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar lg:flex">
        {nav()}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 lg:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col">{nav(() => setMobileOpen(false))}</div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
          <span className="font-display text-base font-semibold">The Francis Files</span>
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
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
    <div className="no-print flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-8 sm:py-5">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
