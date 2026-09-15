/**
 * Reflow a transcription that preserved the physical line wrapping of the
 * handwritten page. Joins continuation lines into flowing paragraphs while
 * keeping blank-line paragraph breaks and short structural lines (dates,
 * headings, salutations, closings, signatures, postscripts) on their own line.
 *
 * Pure text transform — no AI, no network, no mutation of stored text.
 */

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
const COMBINED_PAGE_MARKER =
  /^[ \t]*(?:—|---)\s*Page\s+\d+(?:\s*\([^\n)]*\))?\s*(?:—|---)[ \t]*$/gim;

/**
 * Removes legacy system page headings from a combined transcription. A page
 * boundary becomes a single space so a sentence that crosses scans continues
 * naturally; paragraph breaks inside each page remain untouched.
 */
export function flowingCombinedTranscription(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\r\n?/g, "\n")
    .replace(COMBINED_PAGE_MARKER, "")
    .replace(/\n{2,}[ \t]*\n*/g, "\n\n")
    .replace(/(^|\S)[ \t]*\n{2}(?=\S)/g, (_match, before: string) =>
      before ? `${before}\n\n` : "",
    )
    .replace(/(^|\S)[ \t]*\n(?=\S)/g, (_match, before: string) =>
      before ? `${before} ` : "",
    )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Combines page text without introducing an artificial page boundary. */
export function combineTranscriptionPages(pages: Array<string | null | undefined>): string {
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
