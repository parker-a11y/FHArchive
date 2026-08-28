import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ITEM_SIDES, ITEM_TYPES } from "@/lib/archive";
import type { Letter } from "@/lib/queries";
import { ScansPanel } from "@/components/letter/ScansPanel";

export type ArchiveItem = {
  id: string;
  letter_id: string;
  sort_order: number;
  item_type: string;
  description: string | null;
  side: string | null;
  page_number: string | null;
  item_date: string | null;
  people: string | null;
  notes: string | null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ItemCard({
  item,
  letter,
  onDragStart,
  onDrop,
  onSave,
  onDelete,
}: {
  item: ArchiveItem;
  letter: Letter;
  onDragStart: () => void;
  onDrop: () => void;
  onSave: (patch: Partial<ArchiveItem>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(item);
  const set = (patch: Partial<ArchiveItem>) => setDraft((d) => ({ ...d, ...patch }));

  const typeLabel = ITEM_TYPES.find((t) => t.value === item.item_type)?.label ?? item.item_type;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className="rounded border border-border bg-card"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className="size-4 cursor-grab text-muted-foreground" />
        <span className="archive-id text-xs text-muted-foreground">
          {letter.archive_id}-{String(item.sort_order).padStart(2, "0")}
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left text-sm"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-medium">{typeLabel}</span>
          <span className="truncate text-muted-foreground">{item.description ?? ""}</span>
        </button>
        <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border px-3 py-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Item type">
              <select
                value={draft.item_type}
                onChange={(e) => set({ item_type: e.target.value })}
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Item number / order">
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(e) => set({ sort_order: Number(e.target.value) || 1 })}
              />
            </Field>
            <Field label="Front / Back">
              <select
                value={draft.side ?? ""}
                onChange={(e) => set({ side: e.target.value })}
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
              >
                {ITEM_SIDES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Page number">
              <Input
                value={draft.page_number ?? ""}
                onChange={(e) => set({ page_number: e.target.value })}
              />
            </Field>
            <Field label="Date (if different)">
              <Input
                value={draft.item_date ?? ""}
                onChange={(e) => set({ item_date: e.target.value })}
                placeholder="e.g. 12 May 1945"
              />
            </Field>
            <Field label="People depicted / mentioned">
              <Input
                value={draft.people ?? ""}
                onChange={(e) => set({ people: e.target.value })}
                placeholder="Comma separated"
              />
            </Field>
          </div>
          <Field label="Short description">
            <Input
              value={draft.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={2}
              value={draft.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
          <Button
            size="sm"
            onClick={() =>
              onSave({
                item_type: draft.item_type,
                sort_order: draft.sort_order,
                side: draft.side || null,
                page_number: draft.page_number || null,
                item_date: draft.item_date || null,
                people: draft.people || null,
                description: draft.description || null,
                notes: draft.notes || null,
              })
            }
          >
            Save item
          </Button>

          <div className="pt-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Scans for this item
            </p>
            <ScansPanel
              letter={letter}
              itemId={item.id}
              compact
              emptyLabel="No scans for this item yet."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ItemsPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const key = ["letter-items", letter.id];

  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letter_items")
        .select("*")
        .eq("letter_id", letter.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ArchiveItem[];
    },
  });

  async function addItem() {
    const { error } = await supabase.from("letter_items").insert({
      letter_id: letter.id,
      sort_order: items.length + 1,
      item_type: "other",
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  async function saveItem(id: string, patch: Partial<ArchiveItem>) {
    const { error } = await supabase.from("letter_items").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
    toast.success("Item saved");
  }

  async function deleteItem(item: ArchiveItem) {
    if (!confirm("Remove this item? Its scans stay in the record as unassigned scans.")) return;
    await supabase.from("letter_items").delete().eq("id", item.id);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["scans", letter.id, null] });
  }

  async function reorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const list = [...items];
    const from = list.findIndex((i) => i.id === dragId);
    const to = list.findIndex((i) => i.id === targetId);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setDragId(null);
    await Promise.all(
      list.map((i, idx) =>
        supabase.from("letter_items").update({ sort_order: idx + 1 }).eq("id", i.id),
      ),
    );
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          This FH record can hold any number of physical pieces — invitation, program, photographs,
          envelope, notes — all grouped under {letter.archive_id}. Add a component for each piece and
          attach its scans. Drag rows to reorder.
        </p>
        <Button size="sm" onClick={addItem}>
          <Plus className="mr-1 size-4" /> Add item
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            letter={letter}
            onDragStart={() => setDragId(item.id)}
            onDrop={() => reorder(item.id)}
            onSave={(patch) => saveItem(item.id, patch)}
            onDelete={() => deleteItem(item)}
          />
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No components yet — add one for each distinct piece in the folder.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Record-level scans (not assigned to an item)
        </p>
        <ScansPanel letter={letter} />
      </div>
    </section>
  );
}
