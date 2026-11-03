import fontkit from "@pdf-lib/fontkit";
import type { FontKey } from "./types";

/** EB Garamond files; the same bytes measure the preview and embed in the PDF. */
export const BOOK_FONT_FILES: Record<FontKey, string> = {
  regular: "EBGaramond-Regular.ttf",
  italic: "EBGaramond-Italic.ttf",
  bold: "EBGaramond-SemiBold.ttf",
  boldItalic: "EBGaramond-SemiBoldItalic.ttf",
};

type FkGlyph = { id: number; advanceWidth: number };
type FkFont = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  italicAngle: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  postscriptName: string;
  hasGlyphForCodePoint(cp: number): boolean;
  glyphForCodePoint(cp: number): FkGlyph;
};

export type BookFont = {
  key: FontKey;
  bytes: Uint8Array;
  font: FkFont;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  /** Glyph id + advance for a code point (cached). */
  glyph(cp: number): { gid: number; adv: number; missing: boolean };
};

export type BookFonts = Record<FontKey, BookFont> & {
  width(key: FontKey, text: string, size: number): number;
  missing: Set<string>;
};

export function createBookFonts(bytes: Record<FontKey, Uint8Array>): BookFonts {
  const missing = new Set<string>();
  const make = (key: FontKey): BookFont => {
    const font = (fontkit as unknown as { create(b: Uint8Array): FkFont }).create(bytes[key]);
    const cache = new Map<number, { gid: number; adv: number; missing: boolean }>();
    return {
      key,
      bytes: bytes[key],
      font,
      unitsPerEm: font.unitsPerEm,
      ascent: font.ascent,
      descent: font.descent,
      glyph(cp: number) {
        let g = cache.get(cp);
        if (!g) {
          const has = font.hasGlyphForCodePoint(cp);
          const gl = font.glyphForCodePoint(has ? cp : 0x3f);
          g = { gid: gl.id, adv: gl.advanceWidth, missing: !has };
          if (!has && cp > 32) missing.add(String.fromCodePoint(cp));
          cache.set(cp, g);
        }
        return g;
      },
    };
  };
  const fonts = {
    regular: make("regular"),
    italic: make("italic"),
    bold: make("bold"),
    boldItalic: make("boldItalic"),
    missing,
  } as BookFonts;
  fonts.width = (key, text, size) => {
    const f = fonts[key];
    let w = 0;
    for (const ch of text) w += f.glyph(ch.codePointAt(0)!).adv;
    return (w / f.unitsPerEm) * size;
  };
  return fonts;
}

/** Normalises characters the page should not print as-is (non-breaking spaces etc.). */
export function printableText(text: string): string {
  return text.replace(/[\u00a0\u2007\u202f]/g, " ").replace(/[\u200b\u00ad]/g, "");
}
