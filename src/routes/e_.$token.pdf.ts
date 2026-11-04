import { createFileRoute } from "@tanstack/react-router";
import { getSharedEmailHtml } from "@/lib/email-share.functions";

/** Standalone print page for a shared email: raw email HTML that opens the print dialog once images load. */
export const Route = createFileRoute("/e_/$token/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const html = await getSharedEmailHtml({ data: { token: params.token } });
        if (!html) return new Response("This link is no longer available", { status: 404 });
        const script = `<style>@page{margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}img{break-inside:avoid}#pbar{position:sticky;top:0;z-index:9;display:flex;gap:8px;justify-content:center;padding:10px;background:#f5efe2;border-bottom:1px solid #d8ccb0;font:15px Georgia,serif}#pbar button{font:inherit;padding:8px 16px;border:1px solid #8a6d3b;background:#fff;border-radius:6px;cursor:pointer}@media print{#pbar{display:none}}</style>
<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},300);});document.addEventListener("DOMContentLoaded",function(){var d=document.createElement("div");d.id="pbar";d.innerHTML='<button onclick="window.print()">Print / Save as PDF</button><button onclick="history.length>1?history.back():window.close()">Back</button>';document.body.prepend(d);});</script>`;
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
