import { createFileRoute } from "@tanstack/react-router";
import { getSharedEmailHtml } from "@/lib/email-share.functions";

/** Standalone print page for a shared email: raw email HTML that opens the print dialog once images load. */
export const Route = createFileRoute("/e_/$token/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const html = await getSharedEmailHtml({ data: { token: params.token } });
        if (!html) return new Response("This link is no longer available", { status: 404 });
        const script = `<style>@page{margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}img{break-inside:avoid}</style>
<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},300);});</script>`;
        const out = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${script}</head>`) : script + html;
        return new Response(out, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-robots-tag": "noindex, nofollow",
          },
        });
      },
    },
  },
});
