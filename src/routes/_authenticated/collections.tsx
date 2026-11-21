import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { collectionsQuery } from "@/lib/collections/client";
import { CreateCollectionDialog } from "@/components/collections/CollectionControls";
export const Route = createFileRoute("/_authenticated/collections")({
  loader: ({ context }) => context.queryClient.ensureQueryData(collectionsQuery),
  head: () => ({
    meta: [
      { title: "Collections — The Francis Files" },
      {
        name: "description",
        content: "Overlapping collections of original archive letters, photographs and sources.",
      },
      { property: "og:title", content: "Collections — The Francis Files" },
      {
        property: "og:description",
        content: "Browse related archive records without changing the originals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollectionsPage,
});
function CollectionsPage() {
  const { data } = useSuspenseQuery(collectionsQuery);
  const { canEdit } = useAuth();
  return (
    <AppShell>
      <PageHeader title="Collections" actions={canEdit ? <CreateCollectionDialog /> : undefined} />
      <div className="p-4 sm:p-8">
        {!data.collections.length && (
          <div className="py-16 text-center text-muted-foreground">
            <Tags className="mx-auto mb-3 size-8" />
            <p>No collections yet.</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.collections.map((c) => (
            <Link
              key={c.id}
              to="/collections/$collectionId"
              params={{ collectionId: c.id }}
              className="rounded-md border border-border bg-card p-5 hover:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-xl font-semibold break-words">{c.name}</h2>
                <Tags className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm font-semibold">
                {data.memberships.filter((m) => m.collection_id === c.id).length} records
              </p>
              {c.description && (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
              )}
              <dl className="mt-5 space-y-1 text-xs text-muted-foreground">
                <div>Created {new Date(c.created_at).toLocaleDateString()}</div>
                <div>Updated {new Date(c.updated_at).toLocaleDateString()}</div>
              </dl>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
