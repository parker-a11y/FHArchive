import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/keywords/")({
  head: () => ({
    meta: [
      { title: "Keywords — The Francis Files" },
      {
        name: "description",
        content: "Reusable topical tags applied across The Francis Files collection.",
      },
      { property: "og:title", content: "Keywords — The Francis Files" },
      { property: "og:description", content: "Topical tags used across the letter collection." },
    ],
  }),
  component: () => (
    <AppShell>
      <Keywords />
    </AppShell>
  ),
});

function Keywords() {
  const { isGuestViewer } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: keywords = [] } = useQuery({
    queryKey: ["keywords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("keywords")
        .select("id, name, description")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["keyword_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("keyword_usage_counts");
      if (error) throw error;
      const m: Record<string, number> = {};
      for (const r of data ?? []) {
        m[r.keyword_id] = Number(r.uses);
      }
      return m;
    },
  });

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("keywords").insert({ name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["keywords"] });
  }

  return (
    <>
      <PageHeader title="Keywords" description={`${keywords.length} tags`} />
      <div className="max-w-3xl p-4 sm:p-8">
        {!isGuestViewer && (
          <div className="mb-6 flex gap-2">
            <Input
              placeholder="New keyword, e.g. Officer Candidate School"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add}>Add keyword</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <Link
              key={k.id}
              to="/keywords/$keywordId"
              params={{ keywordId: k.id }}
              className="rounded border border-border bg-card px-3 py-1.5 text-sm hover:border-primary"
            >
              {k.name}
              <span className="ml-2 text-xs text-muted-foreground">{counts[k.id] ?? 0}</span>
            </Link>
          ))}
          {keywords.length === 0 && (
            <p className="text-sm text-muted-foreground">No keywords yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
