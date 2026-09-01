import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const FIELDS =
  "id, archive_id, title, record_type, subtype, author, recipient, date_as_written, normalized_date, sort_date, summary_short";

export default defineTool({
  name: "search_records",
  title: "Search archive records",
  description:
    "Search FH archive records by title, people, places or transcription text. Returns matching records with their FH archive IDs.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Free-text search term, e.g. a name, place or phrase."),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum records to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const like = `%${query.replace(/[%,]/g, " ")}%`;
    const { data, error } = await supabase
      .from("letters")
      .select(FIELDS)
      .or(
        [
          `archive_id.ilike.${like}`,
          `title.ilike.${like}`,
          `author.ilike.${like}`,
          `recipient.ilike.${like}`,
          `origin.ilike.${like}`,
          `destination.ilike.${like}`,
          `summary_short.ilike.${like}`,
          `transcription_verified.ilike.${like}`,
          `transcription_raw_ai.ilike.${like}`,
        ].join(","),
      )
      .order("sort_date", { ascending: true, nullsFirst: false })
      .limit(limit ?? 20);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: rows.length ? JSON.stringify(rows, null, 2) : `No records matched "${query}".`,
        },
      ],
      structuredContent: { count: rows.length, records: rows },
    };
  },
});
