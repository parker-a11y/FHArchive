import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ORG_TYPES, labelOf } from "@/lib/archive";

export const Route = createFileRoute("/organizations/")({
  head: () => ({
    meta: [
      { title: "Organizations & Ships — Harrington Family Archive" },
      {
        name: "description",
        content:
          "Reusable records for ships, military units, employers, schools and other organizations in the Harrington family archive.",
      },
      { property: "og:title", content: "Organizations & Ships — Harrington Family Archive" },
      {
        property: "og:description",
        content: "Ships, units, employers and institutions linked to archive items.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Organizations />
    </AppShell>
  ),
});

function Organizations() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("ship");

  const { data: orgs = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase
      .from("organizations")
      .insert({ name: name.trim(), org_type: orgType });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["organizations"] });
    qc.invalidateQueries({ queryKey: ["entities"] });
  }

  async function update(id: string, patch: { description: string }) {
    const { error } = await supabase.from("organizations").update(patch).eq("id", id);

    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["organizations"] });
  }

  return (
    <>
      <PageHeader
        title="Organizations, Ships & Units"
        description={`${orgs.length} organization records`}
      />
      <div className="max-w-4xl p-8">
        <div className="mb-6 flex gap-2">
          <Input
            placeholder="e.g. USS Doyle C. Barnes (DE-353)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <select
            className="h-9 rounded border border-input bg-background px-2 text-sm"
            value={orgType}
            onChange={(e) => setOrgType(e.target.value)}
          >
            {ORG_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button onClick={add}>Add</Button>
        </div>

        <div className="divide-y divide-border rounded border border-border bg-card">
          {orgs.map((o) => (
            <div key={o.id} className="px-4 py-3">
              <div className="flex items-baseline gap-3">
                <span className="font-medium">{o.name}</span>
                <span className="text-xs text-muted-foreground">
                  {labelOf(ORG_TYPES, o.org_type)}
                </span>
              </div>
              <Input
                className="mt-2 h-8"
                placeholder="Description / notes…"
                defaultValue={o.description ?? ""}
                onBlur={(e) => update(o.id, { description: e.target.value })}
              />
            </div>
          ))}
          {orgs.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">No organizations yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
