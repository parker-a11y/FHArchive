/**
 * Reflow a transcription that preserved the physical line wrapping of the
 * handwritten page. Joins continuation lines into flowing paragraphs while
 * keeping blank-line paragraph breaks and short structural lines (dates,
 * headings, salutations, closings, signatures, postscripts) on their own line.
 *
 * Pure text transform — no AI, no network, no mutation of stored text.
 */

import { isRichHtml, plainTextToRichHtml, sanitizeRichHtml } from "@/lib/rich-text";

const NAVY_LETTERHEAD = /\b(?:u\.?\s*s\.?|united\s+states)\s+(?:navy|naval)\b/i;

function normalizedLetterhead(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function navyBlockFromOpening(value: string, laterPage = false) {
  const input = String(value ?? "");
  if (isRichHtml(input)) {
    const blocks = [...input.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].slice(0, laterPage ? 1 : 3);
    const match = blocks.find((block) => {
      const plain = normalizedLetterhead(block[0]);
      return plain.length <= 160 && NAVY_LETTERHEAD.test(plain);
    });
    if (!match || match.index === undefined) return null;
    return { raw: match[0], start: match.index, end: match.index + match[0].length };
  }

  const blocks = [...input.matchAll(/(?:^|\n{2,})([^\n]+(?:\n(?!\n)[^\n]+)*)/g)].slice(
    0,
    laterPage ? 1 : 3,
  );
  const match = blocks.find((block) => {
    const plain = normalizedLetterhead(block[1]);
    const lines = block[1].split("\n").length;
    return plain.length <= 160 && lines <= 4 && NAVY_LETTERHEAD.test(plain);
  });
  if (!match || match.index === undefined) return null;
  const offset = match[0].length - match[1].length;
  const start = match.index + offset;
  return { raw: match[1], start, end: start + match[1].length };
}

/**
 * Removes repeated Navy stationery from a later page only when the first page
 * establishes that the record uses that letterhead. The match is restricted to
 * the opening block, so ordinary references to the Navy remain untouched.
 */
export function removeRepeatedNavyLetterhead(
  firstPage: string | null | undefined,
  laterPage: string | null | undefined,
) {
  const first = navyBlockFromOpening(String(firstPage ?? ""));
  const repeated = navyBlockFromOpening(String(laterPage ?? ""), true);
  if (!first || !repeated) return String(laterPage ?? "");

  const firstNormalized = normalizedLetterhead(first.raw);
  const repeatedNormalized = normalizedLetterhead(repeated.raw);
  if (!NAVY_LETTERHEAD.test(firstNormalized) || !NAVY_LETTERHEAD.test(repeatedNormalized)) {
    return String(laterPage ?? "");
  }

  const input = String(laterPage ?? "");
  const before = input.slice(0, repeated.start);
  const after = input.slice(repeated.end);
  if (isRichHtml(input)) return sanitizeRichHtml(`${before}${after}`);
  return `${before}${after}`.replace(/^\s*\n+/, "").trimEnd();
}

const SALUTATION = /^(my\s+)?(dear|darling|dearest|hi|hello|beloved)\b/i;
const CLOSING =
  /^(love|all my love|lots of love|yours|yours truly|sincerely|affectionately|fondly|as ever|ever yours|so long|goodnight|good night|bye|xoxo)\b[^.]{0,40}[,-]?\s*$/i;
const POSTSCRIPT = /^p\.?\s?s\.?\b/i;
const DATE_LINE =
  /^\(?\s*(\d{1,2}\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{0,4}(,?\s*\d{4})?\s*\)?$/i;
const NUMERIC_DATE = /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/;

/**
 * A heading inserted by the record roll-up, not text from the document itself.
 * Keep this deliberately narrow so an author's ordinary mention of a page is
 * never removed.
 */
const COMBINED_PAGE_MARKER_SOURCE =
  "(?:—|---)\\s*Page\\s+\\d+(?:\\s*\\([^\\n)]*\\))?\\s*(?:—|---)";

/**
 * Removes legacy system page headings from a combined transcription. A page
 * boundary becomes a single space so a sentence that crosses scans continues
 * naturally; paragraph breaks inside each page remain untouched.
 */
export function flowingCombinedTranscription(input: string | null | undefined): string {
  if (!input) return "";
  const normalized = input.replace(/\r\n?/g, "\n");
  const openingMarker = new RegExp(`^[ \\t]*${COMBINED_PAGE_MARKER_SOURCE}[ \\t]*\\n+`, "i");
  const middleMarker = new RegExp(
    `\\n+[ \\t]*${COMBINED_PAGE_MARKER_SOURCE}[ \\t]*\\n+`,
    "gi",
  );
  return normalized.replace(openingMarker, "").replace(middleMarker, " ").trim();
}

/** Combines page text without introducing an artificial page boundary. */
export function combineTranscriptionPages(pages: Array<string | null | undefined>): string {
  const usable = pages.map((page) => flowingCombinedTranscription(page).trim()).filter(Boolean);
  if (usable.some((page) => isRichHtml(page))) {
    return usable
      .map((page) => (isRichHtml(page) ? sanitizeRichHtml(page) : plainTextToRichHtml(page)))
      .join("");
  }
  return pages
    .map((page) => flowingCombinedTranscription(page).trim())
    .filter(Boolean)
    .join(" ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * A line that should never be merged with its neighbours.
 *
 * `inHeaderRun` is true while we are still in the opening run of the first
 * block — the letterhead/address/date/greeting stack before the letter's prose
 * starts. Those lines keep their own line even when mixed case, which is how
 * "Camp Kilmer, N.J." above "Dear Jaq," survives the cleanup.
 */
function isStructural(
  line: string,
  index: number,
  lines: string[],
  blockIndex: number,
  inHeaderRun: boolean,
): boolean {
  const t = line.trim();
  if (!t) return true;
  if (DATE_LINE.test(t) || NUMERIC_DATE.test(t)) return true;
  if (POSTSCRIPT.test(t)) return true;
  // Greetings belong at the opening, while sign-offs belong at the end. Applying
  // these patterns to every line mistakes ordinary prose such as "hi again" or
  // "love the new house" for structural text.
  if (
    (inHeaderRun || index <= 2) &&
    SALUTATION.test(t) &&
    t.length <= 60 &&
    !/[.!?]$/.test(t)
  ) {
    return true;
  }
  if (index >= lines.length - 3 && CLOSING.test(t)) return true;
  if (/^[-—–*_=]{2,}$/.test(t)) return true;
  if (/^\[.*\]$/.test(t)) return true; // editorial notes like [illegible]
  // Short lines stacked at the very top of the letter are letterhead, place,
  // and address lines — keep them, in any capitalisation.
  if (
    blockIndex === 0 &&
    inHeaderRun &&
    index < 6 &&
    t.length <= 45 &&
    t.split(/\s+/).length <= 6 &&
    (/[,]/.test(t) || /\d/.test(t) || !/[a-z]/.test(t))
  ) {
    return true;
  }
  return false;
}

/** Within a paragraph block, non-structural lines are visual wraps and always join. */
function continues(line: string, next: string): boolean {
  return !!line.trim() && !!next.trim();
}

export function reflowTranscription(input: string): string {
  if (!input) return input;
  const blocks = input.replace(/\r\n?/g, "\n").split(/\n{2,}/);

  const out = blocks.map((block, blockIndex) => {
    const lines = block.split("\n");
    const result: string[] = [];
    let buffer = "";
    let inHeaderRun = true;

    const flush = () => {
      if (buffer.trim()) result.push(buffer.trim());
      buffer = "";
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isStructural(trimmed, i, lines, blockIndex, inHeaderRun)) {
        flush();
        result.push(trimmed);
        return;
      }
      inHeaderRun = false;
      if (!buffer) {
        buffer = trimmed;
        return;
      }
      if (continues(buffer, trimmed)) {
        if (buffer.endsWith("-")) buffer = buffer.slice(0, -1) + trimmed;
        else buffer = `${buffer} ${trimmed}`;
      } else {
        flush();
        buffer = trimmed;
      }
    });
    flush();
    return result.join("\n");
  });

  return out.join("\n\n").replace(/[ \t]+\n/g, "\n").trimEnd();
}

/** Whether reflowing would actually change anything. */
export function needsReflow(text: string): boolean {
  return !!text && reflowTranscription(text) !== text;
}
