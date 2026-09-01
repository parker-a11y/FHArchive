import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_record",
  title: "Get archive record",
  description:
    "Fetch one FH archive record in full by its archive ID (e.g. FH0014), including catalog fields and the best available transcription.",
  inputSchema: {
    archive_id: z.string().trim().min(1).describe("The FH archive ID, e.g. FH0014."),
    include_transcription: z
      .boolean()
      .optional()
      .describe("Include the transcription text (default true)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ archive_id, include_transcription }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("letters")
      .select("*")
      .ilike("archive_id", archive_id)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return {
        content: [{ type: "text", text: `No record found with archive ID ${archive_id}.` }],
        isError: true,
      };

    const record = data as Record<string, unknown>;
    const transcription =
      (record["transcription_verified"] as string | null) ||
      (record["transcription_raw_ai"] as string | null) ||
      (record["ocr_text"] as string | null) ||
      "";
    delete record["transcription_verified"];
    delete record["transcription_raw_ai"];
    delete record["ocr_text"];

    const payload = {
      ...record,
      ...(include_transcription === false ? {} : { transcription }),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: { record: payload },
    };
  },
});
