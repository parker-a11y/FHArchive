import { createFileRoute } from "@tanstack/react-router";

/**
 * Streams a finished Book Builder PDF. The link is signed and expires after
 * 15 minutes; it is only handed out to signed-in editors.
 */
export const Route = createFileRoute("/api/public/book-export-download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id") ?? "";
        const { verifyDownload } = await import("@/lib/book/export.server");
        if (!(await verifyDownload(id, url.searchParams.get("exp") ?? "", url.searchParams.get("sig") ?? ""))) {
          return new Response("This download link has expired. Open Book Builder and download again.", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin.from("book_exports").select("id, kind, status, state, file_size, book_id, created_at").eq("id", id).maybeSingle();
        if (!row || row.status !== "done") return new Response("Export not ready", { status: 404 });
        const { data: book } = await supabaseAdmin.from("book_projects").select("title").eq("id", row.book_id).maybeSingle();
        const parts = ((row.state as any)?.parts ?? []) as Array<{ path: string; size: number }>;
        let i = 0;
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            if (i >= parts.length) {
              controller.close();
              return;
            }
            const { data, error } = await supabaseAdmin.storage.from("book-exports").download(parts[i++].path);
            if (error || !data) {
              controller.error(new Error("Export data missing"));
              return;
            }
            controller.enqueue(new Uint8Array(await data.arrayBuffer()));
          },
        });
        const name = `${(book?.title ?? "book").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "book"}${(row as any).kind === "cover" ? "-cover" : ""}-${String(row.created_at).slice(0, 10)}.pdf`;
        return new Response(stream, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(row.file_size ?? parts.reduce((a, p) => a + p.size, 0)),
            "Content-Disposition": `${url.searchParams.get("inline") ? "inline" : "attachment"}; filename="${name}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
