import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

export type EntityKind = "person" | "place" | "organization" | "event";

export type EntityRef = { kind: EntityKind; name: string };

const KIND_LABEL: Record<EntityKind, string> = {
  person: "People",
  place: "Places",
  organization: "Organizations",
  event: "Events",
};

const KIND_TABLE: Record<EntityKind, { table: string; column: string }> = {
  person: { table: "people", column: "name" },
  place: { table: "places", column: "canonical_name" },
  organization: { table: "organizations", column: "name" },
  event: { table: "events", column: "name" },
};

export const entityKey = (kind: EntityKind, name: string) =>
  `${kind}::${name.trim().toLowerCase()}`;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Confirms brand-new entities that an accepted AI suggestion would create.
 *
 * Names that already exist in the archive are allowed silently. Names the user
 * unchecks are recorded permanently, so the AI never offers them again.
 */
export function useEntityConfirmer() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EntityRef[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const allowedRef = useRef<Set<string>>(new Set());
  const resolveRef = useRef<((allowed: Set<string>) => void) | null>(null);

  const confirmEntities = useCallback(async (refs: EntityRef[]): Promise<Set<string>> => {
    const allowed = new Set<string>();
    const seen = new Set<string>();
    const unique: EntityRef[] = [];
    for (const r of refs) {
      const name = r.name.trim();
      if (!name) continue;
      const key = entityKey(r.kind, name);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ kind: r.kind, name });
    }
    if (!unique.length) return allowed;

    const { data: rejected } = await supabase
      .from("rejected_entities")
      .select("kind,name")
      .in("kind", Array.from(new Set(unique.map((u) => u.kind))));
    const rejectedSet = new Set((rejected ?? []).map((r) => `${r.kind}::${norm(r.name)}`));

    const fresh: EntityRef[] = [];
    for (const u of unique) {
      if (rejectedSet.has(`${u.kind}::${norm(u.name)}`)) continue;
      const { table, column } = KIND_TABLE[u.kind];
      const { data: found } = await (supabase.from(table as "people") as any)
        .select("id")
        .ilike(column, u.name)
        .limit(1)
        .maybeSingle();
      if (found?.id) allowed.add(entityKey(u.kind, u.name));
      else fresh.push(u);
    }

    if (!fresh.length) return allowed;

    allowedRef.current = allowed;
    setItems(fresh);
    setChecked(Object.fromEntries(fresh.map((f) => [entityKey(f.kind, f.name), true])));
    setOpen(true);

    return new Promise<Set<string>>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function finish(allowed: Set<string>) {
    setOpen(false);
    setItems([]);
    setChecked({});
    resolveRef.current?.(allowed);
    resolveRef.current = null;
  }

  async function onConfirm() {
    setSaving(true);
    try {
      const allowed = new Set(allowedRef.current);
      const declined: EntityRef[] = [];
      for (const item of items) {
        const key = entityKey(item.kind, item.name);
        if (checked[key]) allowed.add(key);
        else declined.push(item);
      }
      if (declined.length) {
        const { error } = await supabase
          .from("rejected_entities")
          .insert(declined.map((d) => ({ kind: d.kind, name: d.name })));
        if (error && !/duplicate key/i.test(error.message)) toast.error(error.message);
        else
          toast.message(
            `${declined.length} name(s) declined — they won't be suggested again`,
          );
      }
      finish(allowed);
    } finally {
      setSaving(false);
    }
  }

  const groups = (Object.keys(KIND_LABEL) as EntityKind[])
    .map((kind) => ({ kind, rows: items.filter((i) => i.kind === kind) }))
    .filter((g) => g.rows.length > 0);

  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) finish(new Set(allowedRef.current));
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Confirm new archive records</DialogTitle>
          <DialogDescription>
            Accepting these AI suggestions will create the following new records in the archive.
            Uncheck anything that should not be created — declined names will never be suggested
            again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {groups.map((g) => (
            <div key={g.kind}>
              <div className="field-label mb-2">
                {KIND_LABEL[g.kind]} ({g.rows.length})
              </div>
              <div className="divide-y divide-border rounded border border-border">
                {g.rows.map((row) => {
                  const key = entityKey(row.kind, row.name);
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked[key] ?? true}
                        onCheckedChange={(v) =>
                          setChecked((c) => ({ ...c, [key]: v === true }))
                        }
                      />
                      <span className="font-medium">{row.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">new record</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => finish(new Set(allowedRef.current))}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={saving}>
            {saving ? "Saving…" : "Create checked records"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirmEntities, dialog };
}
