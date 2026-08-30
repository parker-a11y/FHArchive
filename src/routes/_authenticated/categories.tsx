import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RECORD_TYPES, subtypesFor } from "@/lib/archive";
import {
  deleteCategory,
  renameCategory,
  useCategories,
  useInvalidateCategories,
  type Category,
} from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [
      { title: "Category Management — The Francis Files" },
      {
        name: "description",
        content:
          "Rename or remove the record types and subtypes you have added to The Francis Files.",
      },
      { property: "og:title", content: "Category Management — The Francis Files" },
      {
        property: "og:description",
        content: "Manage custom record types and subtypes in the family archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Row({ c, onDone }: { c: Category; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.label);

  const parent = c.parent_type
    ? (RECORD_TYPES.find((r) => r.value === c.parent_type)?.label ?? c.parent_type)
    : null;

  return (
    <div className="flex items-center gap-2 border-b border-border py-2 text-sm last:border-0">
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8" />
        ) : (
          <span className="font-medium">{c.label}</span>
        )}
        <div className="text-xs text-muted-foreground">
          {c.kind === "record_type" ? "Record type" : `Subtype of ${parent}`}
        </div>
      </div>
      {editing ? (
        <>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={async () => {
              try {
                await renameCategory(c.id, draft);
                setEditing(false);
                onDone();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Check className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(false)}>
            <X className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-destructive"
            onClick={async () => {
              if (!confirm(`Delete the category “${c.label}”? Existing records keep their value.`))
                return;
              try {
                await deleteCategory(c.id);
                onDone();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const invalidate = useInvalidateCategories();

  return (
    <AppShell>
      <PageHeader
        title="Categories"
        description="Record types and subtypes you have added. Built-in categories cannot be edited."
      />

      <div className="max-w-3xl rounded border border-border bg-card p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No custom categories yet. Use “+ Add New” in the Record type or Subtype picker on any
            record.
          </p>
        ) : (
          categories.map((c) => <Row key={c.id} c={c} onDone={invalidate} />)
        )}
      </div>

      <div className="mt-6 max-w-3xl rounded border border-border bg-muted/40 p-4">
        <h2 className="text-sm font-semibold">Built-in categories</h2>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {RECORD_TYPES.map((r) => (
            <li key={r.value}>
              <span className="font-medium text-foreground">{r.label}</span> —{" "}
              {subtypesFor(r.value).join(", ")}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
