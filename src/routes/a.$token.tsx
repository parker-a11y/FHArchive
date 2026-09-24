import { createFileRoute } from "@tanstack/react-router";
import { retryUntilFound, NO_STORE_HEADERS } from "@/lib/share-retry";
import { getSharedAsk } from "@/lib/ask-share.functions";

export const Route = createFileRoute("/a/$token")({
  loader: async ({ params }) => ({
    ask: await retryUntilFound(() => getSharedAsk({ data: { token: params.token } })),
  }),
  headers: () => NO_STORE_HEADERS,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.ask
          ? `${loaderData.ask.question.slice(0, 70)} — The Francis Files`
          : "Link unavailable — The Francis Files",
      },
      {
        name: "description",
        content: "A research answer shared from The Francis Files family archive.",
      },
      { property: "og:title", content: loaderData?.ask?.question ?? "Shared answer — The Francis Files" },
      {
        property: "og:description",
        content: "A research answer shared from The Francis Files family archive.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: SharedAskPage,
});

function SharedAskPage() {
  const { ask } = Route.useLoaderData();

  if (!ask) {
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
    <main className="min-h-screen bg-[#f6f4ef] py-8">
      <article className="mx-auto max-w-2xl rounded-xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8">
        <p className="field-label">From the Francis Files archive</p>
        <h1 className="mt-2 font-display text-2xl leading-snug">{ask.question}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(ask.askedAt).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {ask.confidence ? ` · ${ask.confidence}` : ""}
        </p>

        <div className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed">{ask.answer}</div>

        {ask.citations.length > 0 && (
          <section className="mt-6 border-t border-border pt-4">
            <p className="field-label mb-2">Records cited</p>
            <div className="flex flex-wrap gap-1.5">
              {ask.citations.map((c) =>
                c.url ? (
                  <a
                    key={c.archiveId}
                    href={c.url}
                    className="archive-id rounded-full border border-border px-2.5 py-1 text-xs text-archive-gold hover:underline"
                  >
                    {c.archiveId}
                  </a>
                ) : (
                  <span
                    key={c.archiveId}
                    className="archive-id rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {c.archiveId}
                  </span>
                ),
              )}
            </div>
          </section>
        )}

        {ask.sources.length > 0 && (
          <section className="mt-5">
            <p className="field-label mb-1">Outside sources</p>
            <ul className="space-y-1">
              {ask.sources.map((s) => (
                <li key={s.url} className="text-xs">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-archive-gold hover:underline"
                  >
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
          Record links above open a private, read-only view of that item, no account needed. The
          Francis Files, a family archive of Francis A Harrington.
        </footer>
      </article>
    </main>
  );
}
