import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchBoxNames } from "@/components/letter/BoxLabelDialog";

/**
 * Picker for the box / physical storage location a record lives in.
 * Existing box names come from records already filed; "Add New" lets the
 * archivist name a brand-new box without leaving the form.
 */
export function StorageLocationSelect({
  value,
  onChange,
  label = "Box / storage location",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: names = [] } = useQuery({
    queryKey: ["box-names"],
    staleTime: 60_000,
    queryFn: fetchBoxNames,
  });

  const options = value && !names.includes(value) ? [value, ...names] : names;

  function saveNew() {
    const v = draft.trim();
    if (!v) return;
    onChange(v);
    qc.setQueryData<string[]>(["box-names"], (prev) =>
      prev && !prev.includes(v) ? [...prev, v].sort((a, b) => a.localeCompare(b)) : prev,
    );
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="field-label">{label}</Label>
      {adding ? (
        <div className="flex gap-1">
          <Input
            autoFocus
            className="h-9"
            placeholder="New box name, e.g. Box 4"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveNew();
              }
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <Button type="button" size="icon" className="size-9 shrink-0" onClick={saveNew}>
            <Check className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 shrink-0"
            onClick={() => setAdding(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <select
            value={value}
            onChange={(e) => {
              if (e.target.value === "__add_new__") return setAdding(true);
              onChange(e.target.value);
            }}
            className="h-9 w-full rounded border border-input bg-background px-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          >
            <option value="">— none —</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="__add_new__">+ Add New…</option>
          </select>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setAdding(true)}
          >
            <Plus className="mr-1 inline size-3" />
            Add new box
          </button>
        </div>
      )}
    </div>
  );
}
