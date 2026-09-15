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
  const parser = new Parser(
    {
      onopentag(name) {
        if (BLOCK.has(name.toLowerCase())) out += "\n";
      },
      ontext(text) {
        out += text;
      },
      onclosetag(name) {
        if (BLOCK.has(name.toLowerCase())) out += "\n";
      },
    },
    { decodeEntities: true },
  );
  parser.write(String(html ?? ""));
  parser.end();
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
