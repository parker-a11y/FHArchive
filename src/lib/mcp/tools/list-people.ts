import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_people",
  title: "List people",
  description: "List or search the people records in the archive (canonical names and details).",
  inputSchema: {
    query: z.string().trim().optional().describe("Optional name filter."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum people to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let builder = supabase.from("people").select("*").limit(limit ?? 25);
    if (query) builder = builder.ilike("name", `%${query.replace(/[%,]/g, " ")}%`);
    const { data, error } = await builder;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [
        { type: "text", text: rows.length ? JSON.stringify(rows, null, 2) : "No people matched." },
      ],
      structuredContent: { count: rows.length, people: rows },
    };
  },
});
