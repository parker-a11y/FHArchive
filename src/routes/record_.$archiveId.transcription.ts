import { createFileRoute } from "@tanstack/react-router";
import { getPublicRecord } from "@/lib/shares.functions";

function toPlain(text: string) {
  if (!/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Public, no-login plain-text transcription of one record — nothing else. */
export const Route = createFileRoute("/record_/$archiveId/transcription")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const record = await getPublicRecord({ data: { archiveId: params.archiveId } });
        const headers = { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex, nofollow" };
        if (!record) return new Response("Record not found.", { status: 404, headers });
        return new Response(record.transcription ? toPlain(record.transcription) : "No transcription yet.", { headers });
      },
    },
  },
});
