import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_quotations",
  title: "List important quotations",
  description:
    "List notable quotations captured from archive records, with the record they came from.",
  inputSchema: {
    query: z.string().trim().optional().describe("Optional text filter on the quotation."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum records to scan (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("ai_suggestions")
      .select("content, status, letters!inner(archive_id, title, date_as_written, sort_date)")
      .eq("field_key", "quotations")
      .neq("status", "rejected")
      .limit(limit ?? 50);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const needle = query?.toLowerCase();
    const quotes = (data ?? []).flatMap((row) => {
      const letter = (row as { letters?: Record<string, unknown> }).letters ?? {};
      return String(row.content ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !needle || line.toLowerCase().includes(needle))
        .map((text) => ({
          text,
          archive_id: letter["archive_id"],
          title: letter["title"],
          date: letter["date_as_written"] ?? letter["sort_date"],
        }));
    });

    return {
      content: [
        {
          type: "text",
          text: quotes.length ? JSON.stringify(quotes, null, 2) : "No quotations found.",
        },
      ],
      structuredContent: { count: quotes.length, quotations: quotes },
    };
  },
});
