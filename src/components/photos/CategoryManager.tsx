import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Merge, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, deleteCategory, mergeCategory, renameCategory, saveCategoryOrder } from "@/lib/photo-catalog";
import { usePhotoData } from "@/components/photos/usePhotoData";

export function CategoryManager() {
  const d = usePhotoData();
  const [name, setName] = useState("");
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of d.links) m.set(l.category_id, (m.get(l.category_id) ?? 0) + 1);
    return m;
  }, [d.links]);
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error((e as Error).message); }
    d.refresh();
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...d.categories];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    d.patch((old) => ({ ...old, categories: next }));
    void act(() => saveCategoryOrder(next));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void act(() => createCategory(name, d.categories), "Category created").then(() => setName("")); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" aria-label="New category name" />
        <Button type="submit" disabled={!name.trim()}><Plus className="mr-1 size-4" />New Category</Button>
      </form>
      <p className="text-xs text-muted-foreground">Categories describe what a photograph shows. Deleting a category never deletes photographs.</p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {d.categories.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="flex flex-col">
              <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="text-muted-foreground disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
              <button type="button" aria-label={`Move ${c.name} down`} disabled={i === d.categories.length - 1} onClick={() => move(i, 1)} className="text-muted-foreground disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
            </div>
            <Input defaultValue={c.name} aria-label={`Rename ${c.name}`} className="min-w-0 flex-1"
              onBlur={(e) => { if (e.target.value.trim() !== c.name) void act(() => renameCategory(c.id, e.target.value), "Renamed"); }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
            <span className="w-24 text-right text-xs text-muted-foreground">{counts.get(c.id) ?? 0} photographs</span>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Merge className="size-3.5" />
              <select aria-label={`Merge ${c.name} into`} value="" className="rounded-md border border-input bg-background px-1 py-1"
                onChange={(e) => {
                  const into = d.categories.find((x) => x.id === e.target.value);
                  if (into && confirm(`Merge “${c.name}” into “${into.name}”? Its photographs move to “${into.name}” and “${c.name}” is removed.`))
                    void act(() => mergeCategory(c.id, into.id, d.links), "Merged");
                }}>
                <option value="">Merge into…</option>
                {d.categories.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => { if (confirm(`Delete “${c.name}”? Photographs are kept; they just lose this category.`)) void act(() => deleteCategory(c.id), "Category deleted"); }}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
