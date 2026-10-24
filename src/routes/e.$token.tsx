import { retryUntilFound, NO_STORE_HEADERS } from "@/lib/share-retry";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { getSharedEmail, getSharedEmailHtml } from "@/lib/email-share.functions";

export const Route = createFileRoute("/e/$token")({
  loader: async ({ params }) => {
    const [email, html] = await Promise.all([
      retryUntilFound(() => getSharedEmail({ data: { token: params.token } })),
      retryUntilFound(() => getSharedEmailHtml({ data: { token: params.token } })),
    ]);
    return { email, html };
  },
  headers: () => NO_STORE_HEADERS,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.email
          ? `${loaderData.email.subject} — The Francis Files`
          : "Link unavailable — The Francis Files",
      },
      {
        name: "description",
        content: loaderData?.email
          ? `An email shared from The Francis Files archive.`
          : "This shared email link is no longer available.",
      },
      {
        property: "og:title",
        content: loaderData?.email?.subject ?? "Shared email — The Francis Files",
      },
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
  const { email, html } = Route.useLoaderData();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const printedRef = useRef(false);
  const printPdf = () => frameRef.current?.contentWindow?.print();

  if (!email || !html) {
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
        <p className="mb-3 px-2 text-xs text-muted-foreground">
          {email.scheduled ? "Scheduled for" : "Sent"} {new Date(email.sentAt).toLocaleString()}
          {email.senderEmail ? ` · from ${email.senderEmail}` : ""}
          <button
            type="button"
            onClick={printPdf}
            className="ml-3 rounded border border-border bg-card px-2 py-1 font-medium text-foreground hover:bg-secondary"
            title="Opens the print dialog — choose Save as PDF"
          >
            Download PDF
          </button>
        </p>
        <iframe
          ref={frameRef}
          title={email.subject}
          srcDoc={html}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals"
          className="h-[80vh] w-full rounded border border-border bg-white"
          onLoad={(ev) => {
            const frame = ev.currentTarget;
            const doc = frame.contentDocument;
            if (doc) frame.style.height = `${doc.documentElement.scrollHeight + 32}px`;
            if (!printedRef.current && new URLSearchParams(window.location.search).get("print") === "1") {
              printedRef.current = true;
              setTimeout(() => frame.contentWindow?.print(), 600);
            }
          }}
        />
      </div>
      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        The Francis Files · shared privately by link
      </footer>
    </main>
  );
}
