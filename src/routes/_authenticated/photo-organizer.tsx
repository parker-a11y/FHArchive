import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { galleryOptions } from "@/routes/_authenticated/photos";
import { PhotoOrganizer } from "@/components/photos/PhotoOrganizer";
import { PhotoRecordList } from "@/components/photos/PhotoRecordList";
import { BatchUpload } from "@/components/photos/BatchUpload";
import { CategoryManager } from "@/components/photos/CategoryManager";
import { PhNumbering } from "@/components/photos/PhNumbering";

const TABS = [
  { id: "organize", label: "Organizer" },
  { id: "list", label: "Record List" },
  { id: "upload", label: "Upload" },
  { id: "categories", label: "Categories" },
  { id: "numbering", label: "PH Numbering" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/_authenticated/photo-organizer")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; photo?: string } => ({
    tab: TABS.some((t) => t.id === s.tab) ? (s.tab as Tab) : undefined,
    photo: typeof s.photo === "string" && s.photo ? s.photo : undefined,
  }),
  head: () => ({ meta: [
    { title: "Photo Organizer — The Francis Files" },
    { name: "description", content: "Upload, number, categorize and box the family photographs." },
    { property: "og:title", content: "Photo Organizer — The Francis Files" },
    { property: "og:description", content: "Administrative tools for the PH photo catalog." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(galleryOptions),
  pendingComponent: () => <AppShell><PageHeader title="Photo Organizer" /><p className="p-8 text-sm text-muted-foreground">Loading photographs…</p></AppShell>,
  component: () => <AppShell><Page /></AppShell>,
});

function Page() {
  const { isAdmin, loading } = useAuth();
  const { tab = "organize", photo } = Route.useSearch();
  const navigate = useNavigate({ from: "/photo-organizer" });
  if (loading) return null;
  if (!isAdmin) return <><PageHeader title="Photo Organizer" /><p className="p-8 text-sm text-muted-foreground">The Photo Organizer is available to administrators. <Link to="/photos" className="text-primary underline">Open the Photo Archive</Link>.</p></>;
  return (
    <>
      <PageHeader title="Photo Organizer" description="Scan first. Organize when convenient. Identify when possible. Preserve forever."
        actions={<Button asChild variant="outline" size="sm"><Link to="/photos">View gallery</Link></Button>} />
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-8" aria-label="Photo Organizer sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => navigate({ search: { tab: t.id === "organize" ? undefined : t.id } })}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition ${tab === t.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="px-4 py-4 sm:px-8">
        {tab === "organize" && <PhotoOrganizer initialPhotoId={photo} />}
        {tab === "list" && <PhotoRecordList />}
        {tab === "upload" && <BatchUpload />}
        {tab === "categories" && <CategoryManager />}
        {tab === "numbering" && <PhNumbering />}
      </div>
    </>
  );
}
