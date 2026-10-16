/**
 * Photos embedded directly in a composed message or recap body.
 *
 * A photo is stored as a plain-text token, e.g. `[[photo:FH0042:3]]`, so the
 * existing text columns keep working with no migration. The number is the
 * 1-based page position among that record's viewable images. An optional
 * title follows a bar: `[[photo:FH0042:3|Skip on the dock, 1943]]`.
 */

export type InlinePhoto = {
  url: string;
  identifier: string;
  /** Where the caption links: a public share page, or an in-archive route. */
  href?: string | null;
  /** Optional title written by the archivist, shown under the photo. */
  caption?: string | null;
};

/** Optional `|title` part of a token. */
const CAP_SRC = String.raw`(?:\|[^\]\n<>]*)?`;

/** Same token, with no capture groups — safe inside split() and replace(). */
export const PHOTO_TOKEN_SRC = String.raw`\[\[photo:(?:FH|DS)-?\d{3,}:\d+${CAP_SRC}\]\]`;

export const PHOTO_TOKEN_RE = new RegExp(PHOTO_TOKEN_SRC, "gi");

/** Keeps a title safe to store inside a token. */
export function cleanCaption(caption: string | null | undefined) {
  return String(caption ?? "")
    .replace(/[\]\[|<>\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function capPart(caption?: string | null) {
  const c = cleanCaption(caption);
  return c ? `|${c}` : "";
}

export function photoToken(identifier: string, page = 1, caption?: string | null) {
  return `[[photo:${identifier.toUpperCase()}:${page}${capPart(caption)}]]`;
}

/** The title inside a token, or null. */
export function captionOf(token: string): string | null {
  const m = /\|([^\]]*)\]\]\s*$/.exec(token.trim());
  const c = m ? cleanCaption(decodeEntities(m[1]!)) : "";
  return c || null;
}

function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Map key for a token, so `fh0042` and `FH0042` (with or without a title) resolve to the same photo. */
export function photoKey(token: string) {
  return token.trim().replace(/\|[^\]]*\]\]$/, "]]").toUpperCase();
}

/** An outside picture by web address, e.g. `[[image:https://…/pic.jpg]]`. */
export const IMAGE_URL_TOKEN_SRC = String.raw`\[\[image:https?:\/\/[^\]\s"<>|]+${CAP_SRC}\]\]`;

export function imageUrlToken(url: string, caption?: string | null) {
  return `[[image:${url.trim()}${capPart(caption)}]]`;
}

/** The web address inside an image token, or null. */
export function imageUrlOf(token: string): string | null {
  const m = /^\[\[image:(https?:\/\/[^\]\s"<>|]+)(?:\|[^\]]*)?\]\]$/i.exec(token.trim());
  return m ? m[1]!.replace(/&amp;/g, "&") : null;
}

/** Every distinct token in a block of text, uppercased and without titles. */
export function extractPhotoTokens(text: string): string[] {
  const found = String(text ?? "").match(PHOTO_TOKEN_RE) ?? [];
  return Array.from(new Set(found.map(photoKey)));
}

/** Identifier + page for one token. */
export function parsePhotoToken(token: string): { identifier: string; page: number } | null {
  const m = /^\[\[photo:((?:FH|DS)-?\d{3,}):(\d+)(?:\|[^\]]*)?\]\]$/i.exec(token.trim());
  if (!m) return null;
  return { identifier: m[1]!.toUpperCase(), page: Math.max(1, Number(m[2])) };
}

/**
 * Puts every token on its own paragraph so block-based renderers treat an
 * embedded photo as a standalone element rather than part of a sentence.
 */
export function isolatePhotoTokens(text: string) {
  return String(text ?? "")
    .replace(PHOTO_TOKEN_RE, (m) => `\n\n${m}\n\n`)
    .replace(new RegExp(IMAGE_URL_TOKEN_SRC, "gi"), (m) => `\n\n${m}\n\n`);
}

/** Resolves any photo token (archive or web image), carrying its title. */
export function resolvePhotoToken(
  token: string,
  photos: Record<string, InlinePhoto> | undefined,
): InlinePhoto | null {
  const trimmed = token.trim();
  const caption = captionOf(trimmed);
  const url = imageUrlOf(trimmed);
  if (url) return { url, identifier: "", href: null, caption };
  if (!parsePhotoToken(trimmed)) return null;
  const photo = photos?.[photoKey(trimmed)];
  return photo ? { ...photo, caption } : null;
}

/** Resolves a text block that is nothing but a photo token. */
export function photoOfBlock(
  block: string,
  photos: Record<string, InlinePhoto> | undefined,
): InlinePhoto | null {
  return resolvePhotoToken(block, photos);
}

/** True when the block is a photo token, resolved or not (so it is never printed raw). */
export function isPhotoBlock(block: string) {
  return parsePhotoToken(block.trim()) !== null || imageUrlOf(block) !== null;
}
