import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import {
  KIND_LABEL,
  findLeftoverAiLinks,
  removeLeftoverLinks,
  type LeftoverLink,
} from "@/lib/leftover-links";

export const Route = createFileRoute("/_authenticated/admin/leftover-names")({
  head: () => ({
    meta: [
      { title: "Leftover Names — The Francis Files" },
      {
        name: "description",
        content:
          "Find people, places, organizations and keywords the AI linked to a record that its accepted reading no longer supports.",
      },
      { property: "og:title", content: "Leftover Names" },
      {
        property: "og:description",
        content:
          "Clean up AI-created links left behind after a transcription correction in the Francis Harrington Archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <LeftoverNames />
    </AppShell>
  ),
});

function LeftoverNames() {
  const { loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  const {
    data: rows = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["leftover-ai-links"],
    queryFn: findLeftoverAiLinks,
    enabled: isAdmin,
  });

  const selected = rows.filter((r) => checked[r.id]);

  async function remove() {
    if (!selected.length) return;
    if (
      !confirm(
        `Remove ${selected.length} AI-created link(s)? The people, places and keywords themselves stay in the archive.`,
      )
    )
      return;
    setRemoving(true);
    try {
      const n = await removeLeftoverLinks(selected as LeftoverLink[]);
      toast.success(`${n} leftover link(s) removed`);
      setChecked({});
      qc.invalidateQueries({ queryKey: ["entities"] });
      qc.invalidateQueries({ queryKey: ["letters"] });
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the links");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Leftover Names"
        description="Names the AI linked to a record that its accepted reading no longer supports. Anything you linked by hand is never listed."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Checking…" : "Find leftover names"}
        </Button>
        <Button onClick={remove} disabled={!selected.length || removing}>
          {removing ? "Removing…" : `Remove checked (${selected.length})`}
        </Button>
        <span className="text-sm text-muted-foreground">
          {isFetching ? "" : `${rows.length} leftover link(s) found`}
        </span>
      </div>

      {!isFetching && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing left behind — every AI-created link matches an accepted answer.
        </p>
      ) : (
        <div className="divide-y divide-border rounded border border-border">
          {rows.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
            >
              <Checkbox
                checked={checked[r.id] ?? false}
                onCheckedChange={(v) => setChecked((c) => ({ ...c, [r.id]: v === true }))}
              />
              <span className="w-24 font-mono text-xs text-muted-foreground">{r.archiveId}</span>
              <span className="font-medium">{r.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {KIND_LABEL[r.kind]} · no longer supported
              </span>
            </label>
          ))}
        </div>
      )}
    </>
  );
}
