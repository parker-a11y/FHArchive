import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarRange, Loader2, Sparkles } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { fetchRecaps, formatWeekRange } from "@/lib/recaps";
import { generateWeeklyRecap } from "@/lib/recaps.functions";

export const Route = createFileRoute("/_authenticated/recaps/")({
  head: () => ({
    meta: [
      { title: "Weekly Recaps — The Francis Files" },
      {
        name: "description",
        content:
          "A running narrative of what the Francis Files archive uncovered each week: letters, photographs, people, places and emerging threads.",
      },
      { property: "og:title", content: "Weekly Recaps — The Francis Files" },
      {
        property: "og:description",
        content: "What the archive uncovered each week, told as a short readable story with linked records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <RecapsIndex />
    </AppShell>
  ),
});

function RecapsIndex() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const generate = useServerFn(generateWeeklyRecap);

  const { data: recaps = [], isLoading } = useQuery({ queryKey: ["weekly-recaps"], queryFn: fetchRecaps });

  const run = useMutation({
    mutationFn: async () => generate({ data: { mode: "current" } }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["weekly-recaps"] });
      toast.success("Weekly recap generated.");
      if (result?.week_start) navigate({ to: "/recaps/$weekStart", params: { weekStart: result.week_start } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Weekly Recaps"
        description="What the archive uncovered, week by week — the story behind the records."
        actions={
          isAdmin ? (
            <Button className="gap-2" onClick={() => run.mutate()} disabled={run.isPending}>
              {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-archive-gold" />}
              GENERATE WEEKLY RECAP NOW
            </Button>
          ) : undefined
        }
      />
      <div className="p-4 sm:p-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : recaps.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <CalendarRange className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No recaps yet. A new recap is written automatically every Sunday at 2:00 AM.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recaps.map((r) => (
              <Link
                key={r.id}
                to="/recaps/$weekStart"
                params={{ weekStart: r.week_start }}
                className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-archive-gold/40 hover:shadow-lg"
              >
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  <span className="field-label">{formatWeekRange(r.week_start, r.week_end)}</span>
                  {r.status !== "published" && (
                    <span className="rounded-full bg-tone-ochre-soft px-2 py-0.5 text-[11px] font-medium text-tone-ochre">
                      Draft
                    </span>
                  )}
                  {r.manually_edited && (
                    <span className="text-[11px] text-muted-foreground">edited</span>
                  )}
                </div>
                <h2 className="font-display text-lg font-semibold">{r.title}</h2>
                {r.lede && <p className="mt-1 text-sm text-muted-foreground">{r.lede}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
