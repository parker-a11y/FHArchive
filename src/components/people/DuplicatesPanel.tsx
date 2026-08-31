import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { mergePeople, normalizeName } from "@/lib/person-match";

type Person = { id: string; name: string };

function bigrams(s: string) {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Dice coefficient over character bigrams (0–1). */
function similarity(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const A = bigrams(na);
  const B = bigrams(nb);
  let hits = 0;
  for (const g of A) if (B.has(g)) hits++;
  return (2 * hits) / (A.size + B.size);
}

/** Surname-style token: longest word, used to keep unrelated people apart. */
function surname(name: string) {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2);
  return parts.sort((a, b) => b.length - a.length)[0] ?? "";
}

const THRESHOLD = 0.45;

function groupDuplicates(people: Person[]): Person[][] {
  const parent = people.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const sameSurname = surname(people[i].name) === surname(people[j].name) && surname(people[i].name);
      const score = similarity(people[i].name, people[j].name);
      if (sameSurname || score >= THRESHOLD) union(i, j);
    }
  }

  const groups = new Map<number, Person[]>();
  people.forEach((p, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  });
  return Array.from(groups.values()).filter((g) => g.length > 1);
}

export function DuplicatesPanel() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});

  const { data: people = [] } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });

  const groups = useMemo(() => groupDuplicates(people), [people]);

  async function merge(groupIndex: number, group: Person[]) {
    const targetId =
      target[groupIndex] ??
      // default: the longest, most complete-looking name
      [...group].sort((a, b) => b.name.length - a.name.length)[0].id;
    const sources = group
      .filter((p) => p.id !== targetId && !excluded[p.id])
      .map((p) => p.id);
    if (!sources.length) return toast.error("Nothing selected to merge");
    setBusy(true);
    try {
      await mergePeople(targetId, sources);
      await qc.invalidateQueries({ queryKey: ["people"] });
      await qc.invalidateQueries({ queryKey: ["entities"] });
      toast.success(`Merged ${sources.length} duplicate(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  if (!groups.length)
    return (
      <p className="rounded border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        No likely duplicates found.
      </p>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {groups.length} possible duplicate group(s). Choose who to keep — the others become
        alternate spellings and all their record links move over.
      </p>
      {groups.map((group, gi) => {
        const defaultTarget = [...group].sort((a, b) => b.name.length - a.name.length)[0].id;
        const chosen = target[gi] ?? defaultTarget;
        return (
          <div key={group[0].id} className="rounded border border-border bg-card p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Keep one record
            </p>
            <RadioGroup value={chosen} onValueChange={(v) => setTarget((t) => ({ ...t, [gi]: v }))}>
              {group.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-1 text-sm">
                  <RadioGroupItem value={p.id} id={`t-${p.id}`} />
                  <Label htmlFor={`t-${p.id}`} className="flex-1 cursor-pointer font-normal">
                    {p.name}
                  </Label>
                  {p.id !== chosen && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        disabled={!isAdmin}
                        checked={!excluded[p.id]}
                        onCheckedChange={(v) =>
                          setExcluded((e) => ({ ...e, [p.id]: v !== true }))
                        }
                      />
                      merge in
                    </label>
                  )}
                </div>
              ))}
            </RadioGroup>
            {isAdmin && (
              <div className="mt-3">
                <Button size="sm" disabled={busy} onClick={() => merge(gi, group)}>
                  Merge group
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
