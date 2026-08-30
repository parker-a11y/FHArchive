import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchLetters } from "@/lib/queries";
import { displayDate } from "@/lib/archive";

export const Route = createFileRoute("/keywords/$keywordId")({
  head: () => ({
    meta: [
      { title: "Keyword — The Francis Files" },
      { name: "description", content: "Every letter tagged with this keyword." },
      { property: "og:title", content: "Keyword — The Francis Files" },
      { property: "og:description", content: "Every letter tagged with this keyword." },
    ],
  }),
  component: () => (
    <AppShell>
      <KeywordPage />
    </AppShell>
  ),
});

function KeywordPage() {
  const { keywordId } = Route.useParams();
  const { data: keyword } = useQuery({
    queryKey: ["keyword", keywordId],
    queryFn: async () => {
      const { data } = await supabase.from("keywords").select("*").eq("id", keywordId).maybeSingle();
      return data;
    },
  });
  const { data: links = [] } = useQuery({
    queryKey: ["keyword_letters", keywordId],
    queryFn: async () => {
      const { data } = await supabase
        .from("letter_keywords")
        .select("letter_id, source, confirmed")
        .eq("keyword_id", keywordId);
      return data ?? [];
    },
  });
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });

  const ids = links.map((l) => l.letter_id);
  const rows = letters.filter((l) => ids.includes(l.id));

  return (
    <>
      <PageHeader
        title={(keyword?.name as string) ?? "Keyword"}
        description={`${rows.length} letters`}
      />
      <div className="max-w-3xl p-4 sm:p-8">
        <div className="divide-y divide-border rounded border border-border bg-card">
          {rows.map((l) => {
            const link = links.find((x) => x.letter_id === l.id);
            return (
              <Link
                key={l.id}
                to="/letters/$archiveId"
                params={{ archiveId: l.archive_id }}
                search={{ hl: (keyword?.name as string) ?? undefined, tab: "transcription" }}
                className="flex items-baseline gap-4 px-4 py-2 text-sm hover:bg-muted/60"
              >
                <span className="archive-id text-primary">{l.archive_id}</span>
                <span className="text-muted-foreground">{displayDate(l)}</span>
                <span className="truncate">
                  {l.author || "—"} → {l.recipient || "—"}
                </span>
                {link?.source === "ai" && (
                  <span className="ml-auto rounded bg-archive-ai-surface px-1.5 py-0.5 text-xs text-archive-ai">
                    AI suggested
                  </span>
                )}
              </Link>
            );
          })}
          {rows.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">No letters tagged.</p>
          )}
        </div>
      </div>
    </>
  );
}
