import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { fetchNumberingGaps, saveRetirementReason } from "@/lib/numbering";

export const Route = createFileRoute("/_authenticated/admin/numbering")({
  head: () => ({
    meta: [
      { title: "Numbering & Gaps — The Francis Files" },
      {
        name: "description",
        content:
          "Every unused FH number in the archive sequence, with the reason it was retired, so gaps are never mistaken for missing records.",
      },
      { property: "og:title", content: "Numbering & Gaps" },
      {
        property: "og:description",
        content: "Retired FH numbers and their explanations in the Francis Harrington Archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <NumberingReview />
    </AppShell>
  ),
});

function NumberingReview() {
  const { loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingSeq, setSavingSeq] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  const { data: gaps = [], isLoading } = useQuery({
    queryKey: ["numbering-gaps"],
    queryFn: fetchNumberingGaps,
  });

  const unexplained = gaps.filter((g) => !g.retirement).length;

  async function save(seq: number) {
    const reason = (drafts[seq] ?? "").trim();
    if (!reason) return;
    setSavingSeq(seq);
    try {
      await saveRetirementReason(seq, reason);
      setDrafts((d) => ({ ...d, [seq]: "" }));
      qc.invalidateQueries({ queryKey: ["numbering-gaps"] });
      toast.success("Explanation saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the explanation");
    } finally {
      setSavingSeq(null);
    }
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <PageHeader
        title="Numbering & gaps"
        description="FH numbers are never reused. Any number without a record behind it is listed here with the reason it was retired."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No gaps — every issued FH number has a record behind it.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {gaps.length} unused number{gaps.length === 1 ? "" : "s"}
            {unexplained > 0 ? ` · ${unexplained} still need an explanation` : " · all explained"}
          </p>
          <div className="divide-y rounded-lg border">
            {gaps.map((gap) => (
              <div key={gap.fh_seq} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="w-24 shrink-0 font-mono text-sm">{gap.archive_id}</div>
                {gap.retirement ? (
                  <div className="flex-1 text-sm">
                    <p>{gap.retirement.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Retired {new Date(gap.retirement.retired_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <Input
                      value={drafts[gap.fh_seq] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [gap.fh_seq]: e.target.value }))
                      }
                      placeholder="Why is this number unused?"
                    />
                    <Button
                      size="sm"
                      disabled={savingSeq === gap.fh_seq || !(drafts[gap.fh_seq] ?? "").trim()}
                      onClick={() => save(gap.fh_seq)}
                    >
                      Save
                    </Button>
                  </div>
                )}
                {gap.retirement ? (
                  <span className="text-xs text-muted-foreground sm:ml-auto">Explained</span>
                ) : (
                  <span className="text-xs font-medium text-destructive sm:ml-auto">
                    Needs review
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
