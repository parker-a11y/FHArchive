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
import { useAuth } from "@/hooks/useAuth";
import { mergePeople } from "@/lib/person-match";

type Props = {
  personId: string;
  name: string;
  children: ReactNode;
};

type Person = { id: string; name: string; relationship: string | null };

/** Merge duplicate person records into one main record. */
export function MergePersonButton({ personId, name, children }: Props) {
  const { isGuestViewer } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [mainId, setMainId] = useState(personId);
  const [busy, setBusy] = useState(false);

  const { data: people = [] } = useQuery({
    queryKey: ["people", "merge-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("id,name,relationship")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });

  const others = useMemo(
    () =>
      people.filter(
        (p) =>
          p.id !== personId &&
          (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [people, personId, q],
  );

  const involved = useMemo(
    () => [personId, ...selected],
    [personId, selected],
  );
  const nameOf = (id: string) =>
    id === personId ? name : (people.find((p) => p.id === id)?.name ?? id);

  function toggle(id: string) {
    setSelected((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      if (!next.includes(mainId) && mainId !== personId) setMainId(personId);
      return next;
    });
  }

  async function run() {
    const sources = involved.filter((id) => id !== mainId);
    if (!sources.length) return;
    setBusy(true);
    try {
      await mergePeople(mainId, sources);
      toast.success(`Merged ${sources.length} record(s) into ${nameOf(mainId)}`);
      setOpen(false);
      setSelected([]);
      setQ("");
      await qc.invalidateQueries({ queryKey: ["people"] });
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
          setMainId(personId);
        }
      }}
    >
      {!isGuestViewer && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge “{name}” with other people</DialogTitle>
          <DialogDescription>
            Select the duplicate records for this same person, then choose which one becomes the
            main record. Links, aliases, and old names are preserved on the main record.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-64 divide-y divide-border overflow-auto rounded border border-border">
          {others.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60"
            >
              <Checkbox
                checked={selected.includes(p.id)}
                onCheckedChange={() => toggle(p.id)}
              />
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground">{p.relationship}</span>
            </label>
          ))}
          {others.length === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground">No other people found.</p>
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
                    name="main-person"
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
