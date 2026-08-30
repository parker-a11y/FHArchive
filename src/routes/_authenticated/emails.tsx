import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { fetchSentEmails } from "@/lib/archive-email";

export const Route = createFileRoute("/_authenticated/emails")({
  component: EmailsPage,
  head: () => ({
    meta: [
      { title: "Sent Email · The Francis Files" },
      {
        name: "description",
        content:
          "History of archive emails sent from The Francis Files, with recipients, records and delivery status.",
      },
      { property: "og:title", content: "Sent Email · The Francis Files" },
      {
        property: "og:description",
        content: "Delivery history for emails sent from The Francis Files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const STATUS_STYLES: Record<string, string> = {
  sent: "border-primary/40 bg-primary/10 text-primary",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  suppressed: "border-border bg-secondary text-muted-foreground",
  sending: "border-border bg-secondary text-muted-foreground",
};

function EmailsPage() {
  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["archive-emails"],
    queryFn: fetchSentEmails,
  });

  return (
    <AppShell>
      <PageHeader
        title="Sent Email"
        description="Every email sent from the archive, with recipients and delivery status."
      />
      <div className="px-4 py-6 sm:px-8">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && emails.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing sent yet. Open any record and choose Email to send one.
          </p>
        )}
        <div className="space-y-3">
          {emails.map((e) => (
            <details
              key={e.id}
              className="rounded-lg border border-border bg-card px-4 py-3 open:shadow-sm"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span
                  className={`rounded border px-1.5 py-0.5 text-xs ${
                    STATUS_STYLES[e.status] ?? STATUS_STYLES['sending']
                  }`}
                >
                  {e.status}
                </span>
                <span className="font-medium">{e.subject}</span>
                <span className="text-muted-foreground">
                  {(e.recipients ?? []).map((r) => r.email).join(", ")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(e.sent_at).toLocaleString()}
                </span>
              </summary>
              <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                {e.message_body && <p className="whitespace-pre-wrap">{e.message_body}</p>}
                {e.error && <p className="text-destructive">{e.error}</p>}
              </div>
            </details>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
