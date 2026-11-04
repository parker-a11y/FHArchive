/* eslint-disable @typescript-eslint/no-explicit-any */
import { readableRecordTranscription } from "./combined-transcription.server";

export const WRITER_MODEL = "openai/gpt-6-astra";

export type WriterMessage = { role: "user" | "assistant"; content: string; at: string; records?: string[] };

/** Gathers the facts and full transcription for each selected FH record (read-only). */
export async function gatherRecordMaterial(db: any, archiveIds: string[]) {
  if (!archiveIds.length) return { text: "", found: [] as { archive_id: string; id: string; title: string | null; date: string | null }[] };
  const { data, error } = await db
    .from("letters")
    .select(
      "id, archive_id, title, record_type, subtype, date_as_written, normalized_date, author, recipient, primary_person, origin, destination, dateline, postal_service, postal_notes, censor_mark, forwarded, forwarded_to, has_envelope, has_enclosures, enclosure_description, salutation_as_written, closing_as_written, signature_as_written, summary_short, historical_notes, transcription_verified, transcription_rollup_text, transcription_raw_ai",
    )
    .in("archive_id", archiveIds);
  if (error) throw new Error(`Could not read the records: ${error.message}`);
  const rows = (data ?? []).sort((a: any, b: any) => archiveIds.indexOf(a.archive_id) - archiveIds.indexOf(b.archive_id));
  const blocks: string[] = [];
  for (const r of rows) {
    const raw = r.transcription_verified || r.transcription_rollup_text || r.transcription_raw_ai || null;
    const transcription = raw ? await readableRecordTranscription(db, r.id, raw) : "";
    const line = (k: string, v: unknown) => (v === null || v === undefined || v === "" || v === false ? null : `${k}: ${v === true ? "yes" : v}`);
    blocks.push(
      [
        `=== ${r.archive_id} — ${r.title ?? "Untitled"} ===`,
        line("Record type", [r.record_type, r.subtype].filter(Boolean).join(" / ")),
        line("Date as written", r.date_as_written),
        line("Date (normalized)", r.normalized_date),
        line("From", r.author),
        line("To", r.recipient),
        line("Mailed from (origin)", r.origin),
        line("Mailed to (destination)", r.destination),
        line("Location line", r.dateline),
        line("Envelope present", r.has_envelope),
        line("Postal service", r.postal_service),
        line("Postal / envelope notes", r.postal_notes),
        line("Censor mark", r.censor_mark),
        line("Forwarded to", r.forwarded ? r.forwarded_to || "yes" : null),
        line("Enclosure", r.has_enclosures ? r.enclosure_description || "yes" : null),
        line("Salutation", r.salutation_as_written),
        line("Closing", r.closing_as_written),
        line("Signature", r.signature_as_written),
        line("Archive summary", r.summary_short),
        line("Archivist historical notes", r.historical_notes),
        `Transcription${r.transcription_verified ? " (human verified)" : " (unverified AI)"}:`,
        transcription || "(no transcription yet)",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return {
    text: blocks.join("\n\n"),
    found: rows.map((r: any) => ({ archive_id: r.archive_id, id: r.id, title: r.title, date: r.date_as_written || r.normalized_date })),
  };
}

const OUTPUT_RULES = `
OUTPUT FORMAT: Reply with clean HTML only (no markdown, no code fences). Use <h2> for the post title on the first line, then <p>, <em>, <strong>, and <blockquote> for quoted passages from the letters. Mention records by their ID (e.g. FH0123) so links can be added.
EVIDENCE: The supplied records are the only archival source. Quote only words that appear in the transcriptions. Do not invent letters, people, dates, events or quotations. General historical context is allowed, but mark anything uncertain as such.
If the user asks a question or a revision rather than a new post, respond to that directly in the same HTML format.`;

/** Calls the Lovable AI Gateway (Responses API, streamed) and returns the full reply. */
export async function runWriterTurn(opts: {
  instructions: string;
  material: string;
  history: WriterMessage[];
  prior?: string;
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The writing assistant is not configured on the server.");
  const system = `${opts.instructions.trim()}\n\n${OUTPUT_RULES}\n\nARCHIVE RECORDS FOR THIS SESSION:\n\n${opts.material || "(no records selected)"}${opts.prior ? `\n\nPREVIOUSLY SENT/SCHEDULED EMAILS AND BLOG POSTS (newest and most related first). Use these for continuity: keep the established voice and style, pick up running threads, refer back to earlier posts where natural (e.g. "as we saw last week"), and avoid repeating the same quotes or framing. They are not archival evidence; quote letters only from the records above.\n\n${opts.prior}` : ""}`;
  const input = opts.history.map((m) => ({
    role: m.role,
    content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
  }));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: WRITER_MODEL,
      instructions: system,
      input,
      stream: true,
      store: false,
      reasoning: { effort: "medium" },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = "";
    try {
      msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? "";
    } catch {
      /* not json */
    }
    if (res.status === 429) throw new Error("The AI service is busy — wait a minute and try again.");
    if (res.status === 402) throw new Error(msg || "AI credits are used up — add credits in Settings → Plans & credits.");
    if (res.status === 403) throw new Error(msg || "AI access is blocked for this workspace.");
    throw new Error(`Writing failed (${res.status}): ${(msg || body).slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  let failure = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") out += ev.delta;
        else if (ev.type === "response.failed" || ev.type === "error")
          failure = ev.response?.error?.message || ev.error?.message || ev.message || "The AI could not finish.";
      } catch {
        /* partial line */
      }
    }
  }
  if (!out.trim()) throw new Error(failure || "The AI returned an empty reply (it may have declined). Try a different instruction.");
  return out.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
}

const strip = (s: string) =>
  String(s ?? "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Previously sent/scheduled emails and published posts, for continuity of threads and style. Read-only. */
export async function gatherPriorWriting(db: any, recordIds: string[]): Promise<string> {
  const [{ data: emails }, { data: posts }] = await Promise.all([
    db.from("archive_emails").select("subject,message_body,status,sent_at,scheduled_for,created_at")
      .in("status", ["sent", "scheduled", "queued"]).order("created_at", { ascending: false }).limit(40),
    db.from("weekly_recaps").select("title,lede,body_md,kind,status,created_at")
      .order("created_at", { ascending: false }).limit(25),
  ]);
  const items: { text: string; related: boolean }[] = [];
  for (const e of emails ?? []) {
    const body = strip(e.message_body);
    if (!body) continue;
    const when = (e.sent_at || e.scheduled_for || e.created_at || "").slice(0, 10);
    items.push({ text: `[EMAIL ${e.status} ${when}] ${e.subject ?? ""}\n${body.slice(0, 1500)}`, related: recordIds.some((id) => body.includes(id)) });
  }
  for (const p of posts ?? []) {
    if (p.status && !["published", "ready", "draft"].includes(p.status) && p.status !== "sent") { /* keep all statuses but failed */ }
    if (p.status === "failed") continue;
    const body = strip(`${p.lede ?? ""} ${p.body_md ?? ""}`);
    if (!body) continue;
    items.push({ text: `[${String(p.kind ?? "post").toUpperCase()} ${String(p.created_at ?? "").slice(0, 10)}] ${p.title ?? ""}\n${body.slice(0, 1500)}`, related: recordIds.some((id) => body.includes(id)) });
  }
  items.sort((a, b) => Number(b.related) - Number(a.related));
  let out = "", total = 0;
  for (const it of items) { if (total + it.text.length > 40000) break; out += it.text + "\n\n"; total += it.text.length; }
  return out.trim();
}
