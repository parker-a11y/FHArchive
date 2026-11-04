/**
 * Book themes: typography, margins, ornaments and ink tones. Themes change how
 * a book looks, never what it says — every theme prints the same archive text
 * in the same embedded book typeface. "classic" reproduces the Phase 1 layout
 * exactly, so existing books are unchanged.
 */

export type ThemeId = "classic" | "wartime" | "modern" | "keepsake";
export type Rgb = [number, number, number];

export type Theme = {
  id: ThemeId;
  name: string;
  description: string;
  marginTop: number;
  marginBottom: number;
  marginInside: number;
  marginOutside: number;
  headBaseline: number;
  folioFromBottom: number;
  body: number;
  leading: number;
  paraGap: number;
  captionSize: number;
  /** Running heads: italic small text, or spaced capitals. */
  headCaps: boolean;
  /** Printed between a chapter title and its epigraph, and on the title page. */
  ornament: string | null;
  chapterSize: number;
  tones: { ink: Rgb; muted: Rgb; note: Rgb; paper: Rgb; cover: Rgb };
};

const CLASSIC_TONES = { ink: [0.11, 0.1, 0.09], muted: [0.4, 0.37, 0.34], note: [0.36, 0.25, 0.16], paper: [0.98, 0.96, 0.92], cover: [0.24, 0.18, 0.13] } satisfies Theme["tones"];

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    id: "classic",
    name: "Classic Literary",
    description: "Generous margins, italic running heads, warm black ink.",
    marginTop: 66, marginBottom: 74, marginInside: 72, marginOutside: 58, headBaseline: 40, folioFromBottom: 38,
    body: 11.5, leading: 16.5, paraGap: 6, captionSize: 8.5, headCaps: false, ornament: "❦", chapterSize: 24,
    tones: CLASSIC_TONES,
  },
  wartime: {
    id: "wartime",
    name: "Wartime Ledger",
    description: "Tighter, sturdier pages with capital running heads, like a service record.",
    marginTop: 62, marginBottom: 70, marginInside: 70, marginOutside: 54, headBaseline: 38, folioFromBottom: 36,
    body: 11, leading: 15.5, paraGap: 5, captionSize: 8.5, headCaps: true, ornament: "◆", chapterSize: 22,
    tones: { ink: [0.08, 0.09, 0.1], muted: [0.33, 0.35, 0.37], note: [0.3, 0.22, 0.14], paper: [0.95, 0.94, 0.9], cover: [0.16, 0.2, 0.25] },
  },
  modern: {
    id: "modern",
    name: "Quiet Modern",
    description: "Airy pages, larger text and plain running heads, no ornaments.",
    marginTop: 72, marginBottom: 80, marginInside: 78, marginOutside: 64, headBaseline: 44, folioFromBottom: 42,
    body: 12, leading: 18, paraGap: 8, captionSize: 9, headCaps: false, ornament: null, chapterSize: 26,
    tones: { ink: [0.13, 0.13, 0.13], muted: [0.45, 0.45, 0.45], note: [0.32, 0.26, 0.2], paper: [1, 1, 1], cover: [0.2, 0.2, 0.2] },
  },
  keepsake: {
    id: "keepsake",
    name: "Family Keepsake",
    description: "Soft brown ink, flowered ornaments and a gentle, open page.",
    marginTop: 70, marginBottom: 78, marginInside: 74, marginOutside: 60, headBaseline: 42, folioFromBottom: 40,
    body: 11.5, leading: 17, paraGap: 7, captionSize: 8.5, headCaps: false, ornament: "☙", chapterSize: 24,
    tones: { ink: [0.2, 0.14, 0.1], muted: [0.45, 0.37, 0.3], note: [0.38, 0.27, 0.18], paper: [0.98, 0.95, 0.9], cover: [0.35, 0.22, 0.16] },
  },
};

export const THEME_LIST = Object.values(THEMES);
export const themeFor = (id: string | undefined | null): Theme => THEMES[(id ?? "classic") as ThemeId] ?? THEMES.classic;
export const rgbCss = (c: Rgb) => `rgb(${c.map((v) => Math.round(v * 255)).join(" ")})`;
