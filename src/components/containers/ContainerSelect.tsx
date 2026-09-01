import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createContainer, fetchContainers } from "@/lib/containers";

/**
 * Picker for the ORIGINAL source container (permanent provenance).
 * Distinct from the record's current physical storage location.
 */
export function ContainerSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const { data: containers = [] } = useQuery({
    queryKey: ["containers"],
    staleTime: 10 * 60_000,
    queryFn: fetchContainers,
  });

  async function create() {
    const t = title.trim();
    if (!t) return;
    try {
      const row = await createContainer({ title: t, container_type: "box" });
      setTitle("");
      setCreating(false);
      await qc.invalidateQueries({ queryKey: ["containers"] });
      onChange(row.id);
      toast.success(`Created ${row.box_id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <select
        className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— none —</option>
        {containers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.box_id} · {c.title}
          </option>
        ))}
      </select>
      {creating ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            className="h-8 text-xs"
            placeholder="New container title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button size="sm" className="h-8" onClick={create}>
            Add
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => setCreating(true)}
        >
          <Plus className="mr-1 inline size-3" />
          New container
        </button>
      )}
    </div>
  );
}
