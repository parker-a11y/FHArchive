/**
 * Record type / subtype picker with an inline "+ Add New" escape hatch.
 * New values are saved permanently and selected immediately.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Option } from "@/lib/categories";

const ADD = "__add_new__";

export function CategorySelect({
  value,
  onChange,
  options,
  placeholder = "—",
  allowEmpty = false,
  onCreate,
  className = "h-9",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  allowEmpty?: boolean;
  onCreate: (label: string) => Promise<string>;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const created = await onCreate(draft);
      onChange(created);
      setDraft("");
      setAdding(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (adding) {
    return (
      <div className="flex gap-1">
        <Input
          autoFocus
          value={draft}
          placeholder="New category name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") setAdding(false);
          }}
          className={className}
        />
        <Button size="icon" className="size-9 shrink-0" disabled={busy} onClick={save}>
          <Check className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 shrink-0"
          onClick={() => setAdding(false)}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === ADD) return setAdding(true);
        onChange(e.target.value);
      }}
      className={`${className} w-full rounded border border-input bg-background px-2 text-sm`}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      <option value={ADD}>+ Add New…</option>
    </select>
  );
}
