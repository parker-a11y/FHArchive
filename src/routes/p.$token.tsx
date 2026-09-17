import { createFileRoute } from "@tanstack/react-router";
import { getSharedRecap, getSharedRecapHtml } from "@/lib/recap-share.functions";

export const Route = createFileRoute("/p/$token")({
  loader: async ({ params }) => {
    const [recap, html] = await Promise.all([
      getSharedRecap({ data: { token: params.token } }),
      getSharedRecapHtml({ data: { token: params.token } }),
    ]);
    return { recap, html };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.recap
          ? `${loaderData.recap.title} — The Francis Files`
          : "Link unavailable — The Francis Files",
      },
      {
        name: "description",
        content: loaderData?.recap?.lede
          ? loaderData.recap.lede
          : "A story shared from The Francis Files archive.",
      },
      {
        property: "og:title",
        content: loaderData?.recap?.title ?? "Shared recap — The Francis Files",
      },
      {
        property: "og:description",
        content: loaderData?.recap?.lede ?? "A story shared from The Francis Files archive.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: SharedRecapPage,
});

function SharedRecapPage() {
  const { recap, html } = Route.useLoaderData();

  if (!recap || !html) {
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
    <main className="min-h-screen bg-[#f6f4ef]">
      <div className="mx-auto max-w-3xl px-2 py-6 sm:px-4">
        <iframe
          title={recap.title}
          srcDoc={html}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          className="h-[80vh] w-full rounded border border-border bg-white"
          onLoad={(ev) => {
            const frame = ev.currentTarget;
            const doc = frame.contentDocument;
            if (doc) frame.style.height = `${doc.documentElement.scrollHeight + 32}px`;
          }}
        />
      </div>
      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        The Francis Files · shared privately by link
      </footer>
    </main>
  );
}
