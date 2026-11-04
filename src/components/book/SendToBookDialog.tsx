import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addBookRecords, createBook, listBooks } from "@/lib/book/book.functions";

/** Adds the selected All Records rows to an existing or new book project. */
export function SendToBookDialog({ archiveIds }: { archiveIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: books, isLoading } = useQuery({ queryKey: ["books"], queryFn: () => listBooks(), enabled: open });

  async function send(bookId: string) {
    setBusy(true);
    try {
      await addBookRecords({ data: { bookId, archiveIds } });
      await qc.invalidateQueries({ queryKey: ["books"] });
      toast.success(`Added ${archiveIds.length} record${archiveIds.length === 1 ? "" : "s"} to the book`);
      navigate({ to: "/books/$bookId", params: { bookId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createAndSend() {
    setBusy(true);
    try {
      const r = await createBook({ data: { title: title.trim() } });
      await send(r.id);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BookOpen className="size-4" /> Send to Book Builder ({archiveIds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {archiveIds.length} record{archiveIds.length === 1 ? "" : "s"} to a book</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading books…</p>}
          {books && !books.length && <p className="text-sm text-muted-foreground">No books yet — create one below.</p>}
          <div className="max-h-64 space-y-1 overflow-auto">
            {books?.map((b: any) => (
              <Button key={b.id} variant="outline" className="w-full justify-between" disabled={busy} onClick={() => send(b.id)}>
                <span className="truncate">{b.title}</span>
                <span className="text-xs text-muted-foreground">{b.records} items</span>
              </Button>
            ))}
          </div>
          <div className="flex gap-2 border-t pt-3">
            <Input placeholder="New book title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button disabled={busy || !title.trim()} onClick={createAndSend} className="gap-1">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Records already in the book are not changed; new ones are added at the end.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
