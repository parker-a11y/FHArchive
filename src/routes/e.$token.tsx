import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { getSharedEmail } from "@/lib/email-share.functions";
import { RECORD_TYPES, labelOf } from "@/lib/archive";
import { FfnText } from "@/components/ffn/FfnText";

export const Route = createFileRoute("/e/$token")({
  loader: ({ params }) => getSharedEmail({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.subject} — The Francis Files`
          : "Link unavailable — The Francis Files",
      },
      {
        name: "description",
        content: loaderData
          ? `An email shared from The Francis Files archive.`
          : "This shared email link is no longer available.",
      },
      { property: "og:title", content: loaderData?.subject ?? "Shared email — The Francis Files" },
      {
        property: "og:description",
        content: "An email shared from The Francis Files archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: SharedEmailPage,
});

function SharedEmailPage() {
  const email = Route.useLoaderData();

  if (!email) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl">This link is no longer available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The owner of The Francis Files has disabled or replaced this share link.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="field-label">Email from the archive</div>
          <h1 className="mt-1 font-display text-3xl leading-tight">
            {email.headerTitle ?? email.subject}
          </h1>
          {email.headerSubtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{email.headerSubtitle}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(email.sentAt).toLocaleString()}
            {email.senderEmail ? ` · from ${email.senderEmail}` : ""}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-8">
        {email.messageBody && (
          <section className="whitespace-pre-wrap rounded border border-border bg-card p-5 text-sm leading-relaxed">
            <FfnText text={email.messageBody} />
          </section>
        )}

        {email.records.length > 0 && (
          <section>
            <h2 className="font-display text-lg">Records in this email</h2>
            <ul className="mt-3 space-y-2">
              {email.records.map((r) => (
                <li
                  key={r.archiveId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border bg-card px-4 py-3"
                >
                  <span className="archive-id font-display text-lg">{r.archiveId}</span>
                  {r.recordType && (
                    <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-xs">
                      {labelOf(RECORD_TYPES, r.recordType)}
                    </span>
                  )}
                  {r.title && <span className="text-sm font-medium">{r.title}</span>}
                  {r.date && <span className="text-xs text-muted-foreground">{r.date}</span>}
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      View in archive <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground sm:px-8">
        The Francis Files · shared privately by link
      </footer>
    </main>
  );
}
