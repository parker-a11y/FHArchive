import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createBook, deleteBook, duplicateBook, listBooks } from "@/lib/book/book.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/books/")({
  head: () => ({
    meta: [
      { title: "Book Builder — The Francis Files" },
      { name: "description", content: "Design printed books from the archive's original letters, envelopes and transcriptions." },
      { property: "og:title", content: "Book Builder — The Francis Files" },
      { property: "og:description", content: "Turn selected letters into beautifully designed printed books." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Books />
    </AppShell>
  ),
});

function Books() {
  const { canEdit } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ["books"], queryFn: () => listBooks(), enabled: canEdit });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canEdit) return <p className="p-8 text-sm text-muted-foreground">Book Builder is available to administrators and archivists.</p>;

  async function create() {
    setBusy(true);
    try {
      const r = await createBook({ data: { title, subtitle, description } });
      await qc.invalidateQueries({ queryKey: ["books"] });
      navigate({ to: "/books/$bookId", params: { bookId: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Book Builder"
        description="Each book is its own project. Books only point to archive records — nothing in the archive is changed."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New book
          </Button>
        }
      />
      <div className="p-4 md:p-8">
        {isLoading && <p className="text-sm text-muted-foreground">Loading books…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {data && !data.length && (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="mb-4 text-sm text-muted-foreground">No books yet. Start one and add letters to it.</p>
            <Button onClick={() => setOpen(true)}>Start a book</Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data?.map((b: any) => (
            <div key={b.id} className="flex flex-col rounded-lg border bg-card p-5">
              <Link to="/books/$bookId" params={{ bookId: b.id }} className="font-serif text-xl hover:underline">
                {b.title}
              </Link>
              {b.subtitle && <p className="text-sm italic text-muted-foreground">{b.subtitle}</p>}
              {b.description && <p className="mt-2 line-clamp-3 text-sm">{b.description}</p>}
              <p className="mt-3 text-xs text-muted-foreground">
                {b.records} record{b.records === 1 ? "" : "s"}
                {b.lastExport?.page_count ? ` · last PDF ${b.lastExport.page_count} pages` : ""} · edited {new Date(b.updated_at).toLocaleDateString()}
              </p>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm">
                  <Link to="/books/$bookId" params={{ bookId: b.id }}>Open</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const r = await duplicateBook({ data: { id: b.id } });
                    toast.success("Book duplicated");
                    await qc.invalidateQueries({ queryKey: ["books"] });
                    navigate({ to: "/books/$bookId", params: { bookId: r.id } });
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Delete book"
                  onClick={async () => {
                    if (!confirm(`Delete the book “${b.title}”? The archive records themselves are not affected.`)) return;
                    await deleteBook({ data: { id: b.id } });
                    await qc.invalidateQueries({ queryKey: ["books"] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New book</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title, e.g. Fran & Jaq: The Courtship Letters" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Subtitle (optional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={!title.trim() || busy}>
              Create book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
