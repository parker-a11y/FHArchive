import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Sparkles,
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
  Globe,
  Box,
  ShieldCheck,
  Mail,
  Menu,
  UserCog,
} from "lucide-react";
import logoMark from "@/assets/francis-files-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/catalog", label: "Quick Entry", icon: PlusSquare, adminOnly: true },
  { to: "/letters", label: "All Records", icon: Files },
  { to: "/fff", label: "FFF — Finds", icon: Sparkles },
  { to: "/sources", label: "Digital Sources", icon: Globe },
  { to: "/containers", label: "Source Containers", icon: Box },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/search", label: "Search", icon: Search },
  { to: "/queues", label: "Work Queues", icon: ListChecks, adminOnly: true },
  { to: "/people", label: "People", icon: Users },
  { to: "/organizations", label: "Organizations", icon: Ship },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/places", label: "Places", icon: MapPin },
  { to: "/keywords", label: "Keywords", icon: Tags },
  { to: "/categories", label: "Categories", icon: Tags, adminOnly: true },
  { to: "/emails", label: "Sent Email", icon: Mail, adminOnly: true },
  { to: "/backups", label: "Backups", icon: ShieldCheck, adminOnly: true },
];


export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, isAdmin } = useAuth();
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

  const navItems = isAdmin
    ? NAV
    : NAV.filter((item) => !(item as { adminOnly?: boolean }).adminOnly);


  const nav = (onNavigate?: () => void) => (
    <>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-card shadow-lg">
          <img src={logoMark} alt="" width={1024} height={1024} className="size-8 object-contain" />
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
        {navItems.map((item) => {
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
          <img src={logoMark} alt="" width={1024} height={1024} className="size-7 object-contain" />
          <span className="font-display text-base font-semibold">The Francis Files</span>
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/**
 * Wraps admin/write pages: approved guests are view-only, so deep links to
 * entry/management pages send them back to the dashboard instead of showing
 * forms that would only fail on save.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { loading, isGuestViewer } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isGuestViewer) navigate({ to: "/", replace: true });
  }, [loading, isGuestViewer, navigate]);

  if (isGuestViewer) return null;
  return <>{children}</>;
}

export function PageHeader({
  title,
  description,
  actions,
  center,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  center?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onDashboard = pathname === "/";
  return (
    <div className="no-print flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-5">
      <div className="flex min-w-0 items-center gap-3">
        {!onDashboard && (
          <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
            <Link to="/" aria-label="Back to Dashboard">
              <LayoutDashboard className="size-4" /> Dashboard
            </Link>
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {center && <div className="flex flex-1 items-center justify-center">{center}</div>}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

