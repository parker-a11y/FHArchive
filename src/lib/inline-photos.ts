/**
 * Photos embedded directly in a composed message or recap body.
 *
 * A photo is stored as a plain-text token, e.g. `[[photo:FH0042:3]]`, so the
 * existing text columns keep working with no migration. The number is the
 * 1-based page position among that record's viewable images.
 */

export type InlinePhoto = {
  url: string;
  identifier: string;
  /** Where the caption links: a public share page, or an in-archive route. */
  href?: string | null;
};

export const PHOTO_TOKEN_RE = /\[\[photo:((?:FH|DS)-?\d{3,}):(\d+)\]\]/gi;

export function photoToken(identifier: string, page = 1) {
  return `[[photo:${identifier.toUpperCase()}:${page}]]`;
}

/** Map key for a token, so `fh0042` and `FH0042` resolve to the same photo. */
export function photoKey(token: string) {
  return token.toUpperCase();
}

/** Every distinct token in a block of text, uppercased. */
export function extractPhotoTokens(text: string): string[] {
  const found = String(text ?? "").match(PHOTO_TOKEN_RE) ?? [];
  return Array.from(new Set(found.map(photoKey)));
}

/** Identifier + page for one token. */
export function parsePhotoToken(token: string): { identifier: string; page: number } | null {
  const m = /^\[\[photo:((?:FH|DS)-?\d{3,}):(\d+)\]\]$/i.exec(token.trim());
  if (!m) return null;
  return { identifier: m[1]!.toUpperCase(), page: Math.max(1, Number(m[2])) };
}

/**
 * Puts every token on its own paragraph so block-based renderers treat an
 * embedded photo as a standalone element rather than part of a sentence.
 */
export function isolatePhotoTokens(text: string) {
  return String(text ?? "").replace(PHOTO_TOKEN_RE, (m) => `\n\n${m}\n\n`);
}

/** Resolves a text block that is nothing but a photo token. */
export function photoOfBlock(
  block: string,
  photos: Record<string, InlinePhoto> | undefined,
): InlinePhoto | null {
  const trimmed = block.trim();
  if (!parsePhotoToken(trimmed)) return null;
  return photos?.[photoKey(trimmed)] ?? null;
}

/** True when the block is a photo token, resolved or not (so it is never printed raw). */
export function isPhotoBlock(block: string) {
  return parsePhotoToken(block.trim()) !== null;
}
