/**
 * Converts stored transcription text (rich-text HTML or plain text) into
 * styled blocks without changing a single word, mark or spelling. Only
 * presentation tags are interpreted; every character of content is kept.
 */

export type Inline = { text: string; italic: boolean; bold: boolean; br?: boolean };
export type Block = { kind: "p" | "quote" | "heading" | "item"; inlines: Inline[] };

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", deg: "°", frac12: "½",
  frac14: "¼", frac34: "¾", cent: "¢", pound: "£", sect: "§", para: "¶", middot: "·",
  eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä",
  copy: "©", reg: "®", times: "×", shy: "",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
    }
    const v = NAMED[code.toLowerCase()];
    return v ?? m;
  });
}

const BLOCK_TAGS = new Set(["p", "div", "blockquote", "h1", "h2", "h3", "h4", "li", "ul", "ol", "section", "article", "figure"]);

export function parseTranscription(input: string | null | undefined): Block[] {
  const src = (input ?? "").replace(/\r\n?/g, "\n");
  if (!src.trim()) return [];
  if (!/<[a-z!/][^>]*>/i.test(src)) return parsePlain(src);

  const blocks: Block[] = [];
  let current: Block | null = null;
  let italic = 0;
  let bold = 0;
  let quote = 0;
  let heading = 0;
  const flush = () => {
    if (current && current.inlines.some((i) => i.br || i.text.trim())) {
      // Trim trailing line breaks inside a block.
      while (current.inlines.length && current.inlines[current.inlines.length - 1].br) current.inlines.pop();
      blocks.push(current);
    }
    current = null;
  };
  const ensure = (kind?: Block["kind"]) => {
    if (!current) current = { kind: kind ?? (heading ? "heading" : quote ? "quote" : "p"), inlines: [] };
    return current;
  };

  const re = /<!--[\s\S]*?-->|<\/?([a-z0-9]+)\b[^>]*>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[2] !== undefined) {
      const text = decodeEntities(m[2].replace(/\n+/g, " "));
      if (!text) continue;
      if (!current && !text.trim()) continue;
      ensure().inlines.push({ text, italic: italic > 0, bold: bold > 0 });
      continue;
    }
    if (!m[1]) continue;
    const tag = m[1].toLowerCase();
    const closing = m[0][1] === "/";
    if (tag === "br") {
      ensure().inlines.push({ text: "", italic: false, bold: false, br: true });
    } else if (tag === "em" || tag === "i") {
      italic += closing ? -1 : 1;
      italic = Math.max(0, italic);
    } else if (tag === "strong" || tag === "b") {
      bold += closing ? -1 : 1;
      bold = Math.max(0, bold);
    } else if (BLOCK_TAGS.has(tag)) {
      flush();
      if (tag === "blockquote") quote = Math.max(0, quote + (closing ? -1 : 1));
      if (/^h[1-4]$/.test(tag)) heading = closing ? 0 : 1;
      if (tag === "li" && !closing) {
        current = { kind: "item", inlines: [{ text: "• ", italic: false, bold: false }] };
      }
    }
  }
  flush();
  return blocks.map((b) => ({ ...b, inlines: trimEdges(b.inlines) }));
}

function trimEdges(inlines: Inline[]): Inline[] {
  const out = inlines.map((i) => ({ ...i }));
  const first = out.find((i) => !i.br);
  if (first) first.text = first.text.replace(/^[ \t]+/, "");
  const last = [...out].reverse().find((i) => !i.br);
  if (last) last.text = last.text.replace(/[ \t]+$/, "");
  return out;
}

function parsePlain(src: string): Block[] {
  return src
    .split(/\n\s*\n/)
    .map((para) => para.replace(/^\n+|\n+$/g, ""))
    .filter((para) => para.trim())
    .map((para) => {
      const inlines: Inline[] = [];
      para.split("\n").forEach((line, i) => {
        if (i > 0) inlines.push({ text: "", italic: false, bold: false, br: true });
        inlines.push({ text: line, italic: false, bold: false });
      });
      return { kind: "p" as const, inlines };
    });
}

/** Plain characters of the transcription, used to prove nothing was dropped. */
export function blocksPlainText(blocks: Block[]): string {
  return blocks.map((b) => b.inlines.map((i) => (i.br ? "\n" : i.text)).join("")).join("\n\n");
}
