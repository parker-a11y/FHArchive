import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only helpers for AI transcription. The API key never leaves the
 * server: requests go out through the Lovable AI Gateway, which serves the
 * OpenAI vision model with a server-side key.
 */

export const TRANSCRIPTION_MODEL = "openai/gpt-5.4";

export const TRANSCRIPTION_PROMPT = `Transcribe this historical document as faithfully as possible.

Preserve the original wording, spelling, capitalization, punctuation, paragraph breaks, abbreviations, and obvious errors.

Do not modernize the language.
Do not silently correct spelling or grammar.
Do not summarize.
Do not rewrite.

For handwritten material, make the best possible transcription from the image.

If a word or passage cannot be confidently read, mark it as:

[illegible]

If there is a plausible but uncertain reading, use:

[word?]

Do not invent missing text.

Ignore purely decorative or photographic material unless it contains meaningful text.

If the document includes letterhead, handwritten additions, postmarks, censor markings, stamps, marginal notes, or other historically relevant text, include those when legible.

Return transcription text only.`;

export type ScanTarget = {
  fileId: string;
  letterId: string;
  label: string | null;
  sortOrder: number;
  path: string;
  mime: string;
};

/** Picks the web derivative for a master, never the archival TIFF itself. */
export async function resolveScanTargets(
  supabase: SupabaseClient,
  fileIds: string[],
): Promise<ScanTarget[]> {
  if (!fileIds.length) return [];
  const [{ data: files }, { data: derivatives }] = await Promise.all([
    supabase
      .from("digital_files")
      .select("id, letter_id, label, sort_order, original_filename, master_path, master_mime")
      .in("id", fileIds),
    supabase
      .from("file_derivatives")
      .select("file_id, kind, status, storage_path, mime_type")
      .in("file_id", fileIds),
  ]);

  const targets: ScanTarget[] = [];
  for (const f of files ?? []) {
    const jpeg = (derivatives ?? []).find(
      (d) => d.file_id === f.id && d.kind === "jpeg" && d.status === "complete" && d.storage_path,
    );
    const browserViewable = /^image\/(jpeg|png|webp|gif)$/i.test(f.master_mime ?? "");
    const path = jpeg?.storage_path ?? (browserViewable ? f.master_path : null);
    if (!path) continue;
    targets.push({
      fileId: f.id,
      letterId: f.letter_id,
      label: f.label ?? f.original_filename ?? null,
      sortOrder: f.sort_order ?? 0,
      path,
      mime: jpeg?.mime_type ?? f.master_mime ?? "image/jpeg",
    });
  }
  return targets.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function toDataUrl(supabase: SupabaseClient, path: string, mime: string) {
  const { data, error } = await supabase.storage.from("scans").download(path);
  if (error || !data) throw new Error(error?.message ?? "Could not read the scan file");
  const buf = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

async function callGateway(apiKey: string, messages: ChatMessage[]) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TRANSCRIPTION_MODEL,
      // Reasoning tokens are billed against this budget, so keep it generous:
      // a tight budget silently truncates long handwritten pages mid-sentence.
      max_completion_tokens: 32000,
      reasoning_effort: "low",
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limited by the AI service — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    truncated: json.choices?.[0]?.finish_reason === "length",
  };
}

/** Calls the gateway and returns transcription text, or throws a readable error. */
export async function transcribeImage(dataUrl: string, pageNote: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured on the server");

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: `${TRANSCRIPTION_PROMPT}\n\n(${pageNote})` },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ];

  let { text, truncated } = await callGateway(apiKey, messages);

  // If the model ran out of budget mid-page, ask it to continue where it stopped.
  for (let attempt = 0; attempt < 3 && truncated && text.trim(); attempt += 1) {
    messages.push({ role: "assistant", content: text });
    messages.push({
      role: "user",
      content:
        "Continue the transcription from exactly where you stopped. Do not repeat any text already transcribed, do not add commentary. Return transcription text only.",
    });
    const next = await callGateway(apiKey, messages);
    if (!next.text.trim()) break;
    text = `${text.replace(/\s+$/, "")}\n${next.text.replace(/^\s+/, "")}`;
    truncated = next.truncated;
  }

  const finalText = text.trim();
  if (!finalText) throw new Error("The AI returned no transcription text");
  return finalText;
}

export function isEnvelope(label: string | null) {
  return (label ?? "").toLowerCase().includes("envelope");
}
