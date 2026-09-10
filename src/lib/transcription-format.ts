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

/** A line that should never be merged with its neighbours. */
function isStructural(line: string, index: number, lines: string[], blockIndex: number): boolean {
  const t = line.trim();
  if (!t) return true;
  if (DATE_LINE.test(t) || NUMERIC_DATE.test(t)) return true;
  if (POSTSCRIPT.test(t)) return true;
  // Greetings belong at the opening, while sign-offs belong at the end. Applying
  // these patterns to every line mistakes ordinary prose such as "hi again" or
  // "love the new house" for structural text.
  if (index <= 2 && SALUTATION.test(t) && t.length <= 60) return true;
  if (index >= lines.length - 3 && CLOSING.test(t)) return true;
  if (/^[-—–*_=]{2,}$/.test(t)) return true;
  if (/^\[.*\]$/.test(t)) return true; // editorial notes like [illegible]
  // Preserve an unmistakable all-caps heading at the top, not every short line.
  if (
    blockIndex === 0 &&
    index < 4 &&
    t.length <= 40 &&
    /[A-Z]/.test(t) &&
    !/[a-z]/.test(t)
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

    const flush = () => {
      if (buffer.trim()) result.push(buffer.trim());
      buffer = "";
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isStructural(trimmed, i, lines, blockIndex)) {
        flush();
        result.push(trimmed);
        return;
      }
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
