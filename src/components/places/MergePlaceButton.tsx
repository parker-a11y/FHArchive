import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  placeId: string;
  name: string;
  children: ReactNode;
};

type Place = { id: string; canonical_name: string; country: string | null };

export async function mergePlaces(targetId: string, sourceIds: string[]) {
  const { error } = await (supabase.rpc as any)("merge_places", {
    _target_id: targetId,
    _source_ids: sourceIds,
  });
  if (error) throw new Error(error.message);
}

/** Merge duplicate place records into one main record. */
export function MergePlaceButton({ placeId, name, children }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [mainId, setMainId] = useState(placeId);
  const [busy, setBusy] = useState(false);

  const { data: places = [] } = useQuery({
    queryKey: ["places", "merge-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("places")
        .select("id,canonical_name,country")
        .order("canonical_name");
      if (error) throw error;
      return (data ?? []) as Place[];
    },
  });

  const others = useMemo(
    () =>
      places.filter(
        (p) =>
          p.id !== placeId &&
          (!q.trim() || p.canonical_name.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [places, placeId, q],
  );

  const involved = useMemo(() => [placeId, ...selected], [placeId, selected]);
  const nameOf = (id: string) =>
    id === placeId ? name : (places.find((p) => p.id === id)?.canonical_name ?? id);

  function toggle(id: string) {
    setSelected((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      if (!next.includes(mainId) && mainId !== placeId) setMainId(placeId);
      return next;
    });
  }

  async function run() {
    const sources = involved.filter((id) => id !== mainId);
    if (!sources.length) return;
    setBusy(true);
    try {
      await mergePlaces(mainId, sources);
      toast.success(`Merged ${sources.length} record(s) into ${nameOf(mainId)}`);
      setOpen(false);
      setSelected([]);
      setQ("");
      await qc.invalidateQueries({ queryKey: ["places"] });
      await qc.invalidateQueries({ queryKey: ["entities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setSelected([]);
          setQ("");
          setMainId(placeId);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge “{name}” with other places</DialogTitle>
          <DialogDescription>
            Select the duplicate records for this same place, then choose which one becomes the main
            record. Record and digital-source links are moved to the main record.
          </DialogDescription>
        </DialogHeader>

        <Input placeholder="Search places…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-64 divide-y divide-border overflow-auto rounded border border-border">
          {others.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60"
            >
              <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
              <span className="font-medium">{p.canonical_name}</span>
              <span className="text-muted-foreground">{p.country}</span>
            </label>
          ))}
          {others.length === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground">No other places found.</p>
          )}
        </div>

        {selected.length > 0 && (
          <div className="rounded border border-border p-3">
            <p className="mb-2 text-sm font-medium">Keep as the main record</p>
            <div className="space-y-1">
              {involved.map((id) => (
                <label key={id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="main-place"
                    checked={mainId === id}
                    onChange={() => setMainId(id)}
                  />
                  <span>{nameOf(id)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={busy || selected.length === 0} onClick={() => void run()}>
            Merge {selected.length > 0 ? `${selected.length + 1} records` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
