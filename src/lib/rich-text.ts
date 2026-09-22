/**
 * Rich text written in the composer and the recap editor.
 *
 * Notes are stored in the same text columns as before. Plain text keeps
 * rendering through the old markdown-ish path; anything produced by the
 * WYSIWYG editor is stored as a small, strictly allow-listed subset of HTML
 * and is detected here so both forms keep working forever.
 */
import { Parser } from "htmlparser2";

const BLOCK = new Set(["p", "h2", "h3", "ul", "ol", "li", "blockquote", "hr", "br", "div"]);

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "span",
]);

const ALIGNMENTS = new Set(["left", "center", "right", "justify"]);
const VOID_TAGS = new Set(["br", "hr"]);

/** True when the stored value came from the rich-text editor. */
export function isRichHtml(text: string | null | undefined) {
  const t = String(text ?? "");
  return /<(p|h2|h3|ul|ol|li|blockquote|strong|em|u|s|a|span|br|hr|div)\b[^>]*>/i.test(t);
}

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converts legacy plain text to the small HTML subset used by visual editors. */
export function plainTextToRichHtml(value: string) {
  const text = String(value ?? "");
  if (!text.trim()) return "";
  if (isRichHtml(text)) return sanitizeRichHtml(text);
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/**
 * Formats a plain-text paste when it contains complete quoted paragraphs.
 * Returns null when there is nothing to transform so the editor can retain
 * its normal paste behaviour.
 */
export function quotedPasteToRichHtml(value: string) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return null;

  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const isQuotation = (block: string) => {
    const compact = block.replace(/\s+/g, " ").trim();
    return /^(?:[“”]|&ldquo;|\")[\s\S]+(?:[“”]|&rdquo;|\")$/.test(compact);
  };

  if (!blocks.some(isQuotation)) return null;

  return blocks
    .map((block) => {
      const content = escapeHtml(block).replace(/\n/g, "<br />");
      return isQuotation(block) ? `<blockquote>${content}</blockquote>` : `<p>${content}</p>`;
    })
    .join("");
}

/** Keeps only the handful of declarations the toolbar can produce. */
export function safeStyle(style: string | undefined) {
  if (!style) return "";
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const [rawProp, ...rest] = decl.split(":");
    const prop = (rawProp ?? "").trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!prop || !value || /[<>()]/.test(value)) continue;
    if (prop === "text-align" && ALIGNMENTS.has(value.toLowerCase())) out.push(`text-align:${value}`);
    if (prop === "font-family" && value.length < 120)
      out.push(`font-family:${value.replace(/["']/g, "'")}`);
  }
  return out.join(";");
}

export function safeHref(href: string | undefined) {
  const url = String(href ?? "").trim();
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
}

/** Strips everything the editor is not allowed to produce. */
export function sanitizeRichHtml(html: string) {
  let out = "";
  const open: string[] = [];
  let skip = 0;
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const tag = name.toLowerCase();
        if (tag === "script" || tag === "style") skip++;
        if (!ALLOWED_TAGS.has(tag)) return;
        let attrs = "";
        const style = safeStyle(attribs["style"]);
        if (style) attrs += ` style="${escapeHtml(style)}"`;
        if (tag === "a") {
          const href = safeHref(attribs["href"]);
          if (!href) return;
          attrs += ` href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"`;
        }
        if (VOID_TAGS.has(tag)) {
          out += `<${tag}${attrs} />`;
          return;
        }
        open.push(tag);
        out += `<${tag}${attrs}>`;
      },
      ontext(text) {
        if (skip > 0) return;
        out += escapeHtml(text);
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === "script" || tag === "style") skip = Math.max(0, skip - 1);
        if (VOID_TAGS.has(tag) || !ALLOWED_TAGS.has(tag)) return;
        const last = open.lastIndexOf(tag);
        if (last === -1) return;
        open.splice(last, 1);
        out += `</${tag}>`;
      },
    },
    { decodeEntities: true },
  );
  parser.write(String(html ?? ""));
  parser.end();
  while (open.length) out += `</${open.pop()}>`;
  return out;
}

/** Readable plain text, for previews, digests and search. */
export function richTextToPlain(html: string) {
  if (!isRichHtml(html)) return String(html ?? "");
  let out = "";
  let skip = 0;
  const parser = new Parser(
    {
      onopentag(name) {
        const tag = name.toLowerCase();
        if (tag === "script" || tag === "style") skip++;
        if (BLOCK.has(tag)) out += "\n";
      },
      ontext(text) {
        if (skip === 0) out += text;
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === "script" || tag === "style") skip = Math.max(0, skip - 1);
        if (BLOCK.has(tag)) out += "\n";
      },
    },
    { decodeEntities: true },
  );
  parser.write(String(html ?? ""));
  parser.end();
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
