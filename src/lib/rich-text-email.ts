/**
 * Turns editor HTML into email-safe HTML: inline styles only, archive photos
 * rendered as captioned images, and FH / DS numbers linked to share pages.
 */
import { Parser } from "htmlparser2";
import { escapeHtml, safeHref, safeStyle } from "@/lib/rich-text";
import { PHOTO_TOKEN_RE, photoKey, type InlinePhoto } from "@/lib/inline-photos";

const STYLES: Record<string, string> = {
  p: "font-size:15px;line-height:24px;color:#33372b;margin:0 0 14px;",
  h2: "font-size:19px;line-height:28px;color:#2f3327;font-weight:bold;margin:22px 0 8px;",
  h3: "font-size:16px;line-height:24px;color:#2f3327;font-weight:bold;margin:18px 0 6px;",
  ul: "font-size:15px;line-height:24px;color:#33372b;margin:0 0 14px;padding-left:22px;",
  ol: "font-size:15px;line-height:24px;color:#33372b;margin:0 0 14px;padding-left:22px;",
  li: "margin:0 0 6px;",
  blockquote:
    "border-left:4px solid #cbb26a;background:#faf7f0;margin:0 0 16px;padding:10px 14px;font-style:italic;color:#33372b;",
  a: "color:#8a6a1f;text-decoration:underline;",
  hr: "border:none;border-top:1px solid #e4dcc7;margin:22px 0;",
};

const ALLOWED = new Set([
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
const VOID_TAGS = new Set(["br", "hr"]);

const RECORD_RE = /(FH-?\d{3,}|DS-?\d{3,})/g;

function linkRecords(text: string, shareLinks: Record<string, string>) {
  if (!Object.keys(shareLinks).length) return escapeHtml(text);
  // Photo tokens are replaced later; never link the record number inside one.
  return text
    .split(new RegExp(`(${PHOTO_TOKEN_RE.source})`, "gi"))
    .map((chunk) => (/^\[\[photo:/i.test(chunk) ? chunk : linkRun(chunk, shareLinks)))
    .join("");
}

function linkRun(text: string, shareLinks: Record<string, string>) {
  return text
    .split(RECORD_RE)
    .map((part) => {
      if (!/^(FH|DS)-?\d{3,}$/i.test(part)) return escapeHtml(part);
      const key = part.toUpperCase();
      const url = shareLinks[key] ?? shareLinks[key.replace(/-/g, "")];
      return url
        ? `<a href="${escapeHtml(url)}" style="${STYLES["a"]}font-weight:bold;">${escapeHtml(part)}</a>`
        : escapeHtml(part);
    })
    .join("");
}

function photoHtml(photo: InlinePhoto) {
  const img = `<img src="${escapeHtml(photo.url)}" alt="${escapeHtml(
    photo.identifier,
  )} archive photo" style="width:100%;max-width:560px;border-radius:6px;border:1px solid #e4dcc7;" />`;
  const caption = photo.href
    ? `<a href="${escapeHtml(photo.href)}" style="${STYLES["a"]}font-weight:bold;">${escapeHtml(
        photo.identifier,
      )}</a>`
    : escapeHtml(photo.identifier);
  return `<div style="margin:18px 0;">${
    photo.href ? `<a href="${escapeHtml(photo.href)}">${img}</a>` : img
  }<div style="margin:6px 0 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#a08a3f;font-family:Helvetica,Arial,sans-serif;">${caption}</div></div>`;
}

export function richHtmlToEmail(
  html: string,
  opts: { shareLinks?: Record<string, string>; inlinePhotos?: Record<string, InlinePhoto> } = {},
) {
  const shareLinks = opts.shareLinks ?? {};
  const photos = opts.inlinePhotos ?? {};
  let out = "";
  const open: string[] = [];
  let skip = 0;

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const tag = name.toLowerCase();
        if (tag === "script" || tag === "style") skip++;
        if (!ALLOWED.has(tag)) return;
        const own = safeStyle(attribs["style"]);
        const style = `${STYLES[tag] ?? ""}${own ? `${own};` : ""}`;
        let attrs = style ? ` style="${escapeHtml(style)}"` : "";
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
        out += linkRecords(text, shareLinks);
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === "script" || tag === "style") skip = Math.max(0, skip - 1);
        if (VOID_TAGS.has(tag) || !ALLOWED.has(tag)) return;
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

  // A paragraph that holds nothing but a photo becomes the photo itself.
  const token = PHOTO_TOKEN_RE.source;
  out = out.replace(new RegExp(`<p[^>]*>\\s*(${token})\\s*</p>`, "gi"), (_m, t: string) => {
    const photo = photos[photoKey(t)];
    return photo ? photoHtml(photo) : "";
  });
  out = out.replace(new RegExp(token, "gi"), (t) => {
    const photo = photos[photoKey(t)];
    return photo ? photoHtml(photo) : "";
  });
  return out;
}
