import { supabase } from "@/integrations/supabase/client";

/**
 * Important quotations are derived from the AI analysis suggestions stored in
 * `ai_suggestions` under the `quotations` field key. Each suggestion holds one
 * quote per line; this module splits them into individual, sortable rows.
 *
 * Nothing here writes archival data — it is a read-only view over suggestions.
 */

export type QuoteRecord = {
  id: string;
  letter_id: string;
  archive_id: string;
  title: string | null;
  author: string | null;
  recipient: string | null;
  date_as_written: string | null;
  normalized_date: string | null;
  date_precision: string;
  date_certainty: string;
  sort_date: string | null;
};

export type Quotation = QuoteRecord & {
  /** Stable per-quote key: suggestion id + line index. */
  key: string;
  quote: string;
  status: string;
};

/** Trims list bullets and wrapping quote marks from one AI-supplied line. */
function cleanQuote(line: string): string {
  return line
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/^["“”'']+/, "")
    .replace(/["“”'']+$/, "")
    .trim();
}

export function splitQuotes(content: string | null | undefined): string[] {
  if (!content) return [];
  return content
    .split(/\r?\n+/)
    .map(cleanQuote)
    .filter((s) => s.length > 3 && s.toLowerCase() !== "none");
}

type Row = {
  id: string;
  letter_id: string;
  status: string;
  content: string | null;
  letters: QuoteRecord | null;
};

export async function fetchQuotations(): Promise<Quotation[]> {
  const { data, error } = await supabase
    .from("ai_suggestions")
    .select(
      "id, letter_id, status, content, letters!inner(id, archive_id, title, author, recipient, date_as_written, normalized_date, date_precision, date_certainty, sort_date)",
    )
    .eq("field_key", "quotations")
    .neq("status", "rejected");
  if (error) throw error;

  const out: Quotation[] = [];
  for (const row of (data ?? []) as unknown as Row[]) {
    const rec = row.letters;
    if (!rec) continue;
    splitQuotes(row.content).forEach((quote, i) => {
      out.push({
        ...rec,
        letter_id: row.letter_id,
        id: row.id,
        key: `${row.id}-${i}`,
        quote,
        status: row.status,
      });
    });
  }
  return out;
}

/** Sortable timestamp for a quote's record; undated records sort last. */
export function quoteTime(q: Quotation): number | null {
  const d = q.normalized_date ?? q.sort_date;
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : t;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/["“”'']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type QuoteSource = {
  fileId: string | null;
  pageLabel: string | null;
  pageIndex: number | null;
  text: string;
};

/**
 * Finds the transcribed page whose text contains the quote. Falls back to the
 * record-level transcription when no single page matches.
 */
export async function findQuoteSource(
  letterId: string,
  quote: string,
): Promise<QuoteSource | null> {
  const needle = normalize(quote).slice(0, 120);
  const { data: pages } = await supabase
    .from("scan_transcriptions")
    .select("file_id, page_label, page_index, ai_text, verified_text")
    .eq("letter_id", letterId)
    .order("page_index");

  for (const p of pages ?? []) {
    const text = (p.verified_text ?? p.ai_text ?? "").trim();
    if (!text) continue;
    if (normalize(text).includes(needle)) {
      return {
        fileId: p.file_id,
        pageLabel: p.page_label,
        pageIndex: p.page_index,
        text,
      };
    }
  }

  const { data: letter } = await supabase
    .from("letters")
    .select("transcription_verified, transcription_raw_ai, ocr_text")
    .eq("id", letterId)
    .maybeSingle();
  const text = (
    letter?.transcription_verified ||
    letter?.transcription_raw_ai ||
    letter?.ocr_text ||
    ""
  ).trim();
  if (!text) return null;
  return { fileId: null, pageLabel: null, pageIndex: null, text };
}
