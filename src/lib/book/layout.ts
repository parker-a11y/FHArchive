/**
 * Book layout engine — the single source of truth for pagination. It turns a
 * book's ordered records into physical pages (original letter scans, then
 * envelope, then transcription). The preview renders these pages directly and
 * the PDF writer serialises the very same plan.
 */
import { printableText, type BookFonts } from "./fonts";
import { parseTranscription, type Inline } from "./text";
import {
  PRINT_DPI_GOOD,
  PRINT_DPI_MIN,
  type BookImage,
  type BookMeta,
  type BookPlan,
  type BookRecordSource,
  type BookWarning,
  type FontKey,
  type PageElement,
  type PlannedPage,
} from "./types";

export const LAYOUT = {
  marginTop: 66,
  marginBottom: 74,
  marginInside: 72,
  marginOutside: 58,
  headBaseline: 40,
  folioFromBottom: 38,
  body: 11.5,
  leading: 16.5,
  paraGap: 6,
  captionSize: 8.5,
};

type Seg = { text: string; font: FontKey };
type Word = { segs: Seg[]; width: number };
type Line = { words: Word[]; hard: boolean; indent: number };

const fontFor = (i: { italic: boolean; bold: boolean }): FontKey =>
  i.bold && i.italic ? "boldItalic" : i.bold ? "bold" : i.italic ? "italic" : "regular";

export function buildPlan(meta: BookMeta, records: BookRecordSource[], fonts: BookFonts): BookPlan {
  const W = meta.trimWidthIn * 72;
  const H = meta.trimHeightIn * 72;
  const pages: PlannedPage[] = [];
  const warnings: BookWarning[] = [];
  const L = LAYOUT;
  const contentW = W - L.marginInside - L.marginOutside;
  const bottom = H - L.marginBottom;

  const leftOf = (index: number) => (index % 2 === 1 ? L.marginInside : L.marginOutside);

  // ---- line breaking ------------------------------------------------------
  function wordsOf(inlines: Inline[], size: number): Array<Word | "br"> {
    const out: Array<Word | "br"> = [];
    let cur: Seg[] = [];
    const push = () => {
      if (!cur.length) return;
      out.push({ segs: cur, width: cur.reduce((w, s) => w + fonts.width(s.font, s.text, size), 0) });
      cur = [];
    };
    for (const inl of inlines) {
      if (inl.br) {
        push();
        out.push("br");
        continue;
      }
      const font = fontFor(inl);
      for (const piece of printableText(inl.text).split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) push();
        else cur.push({ text: piece, font });
      }
    }
    push();
    return out;
  }

  function breakLines(inlines: Inline[], size: number, maxW: number): Line[] {
    const items = wordsOf(inlines, size);
    const space = fonts.width("regular", " ", size);
    const lines: Line[] = [];
    let line: Word[] = [];
    let width = 0;
    const end = (hard: boolean) => {
      lines.push({ words: line, hard, indent: 0 });
      line = [];
      width = 0;
    };
    for (const it of items) {
      if (it === "br") {
        end(true);
        continue;
      }
      let word = it;
      // A single unbreakable token wider than the line is split by character.
      while (word.width > maxW) {
        if (line.length) end(false);
        const [head, rest] = splitWord(word, size, maxW);
        line = [head];
        width = head.width;
        end(false);
        word = rest;
      }
      const add = line.length ? space + word.width : word.width;
      if (line.length && width + add > maxW + 0.01) end(false);
      line.push(word);
      width += line.length > 1 ? space + word.width : word.width;
    }
    if (line.length || !lines.length) end(true);
    else if (lines.length) lines[lines.length - 1].hard = true;
    return lines;
  }

  function splitWord(word: Word, size: number, maxW: number): [Word, Word] {
    const head: Seg[] = [];
    const rest: Seg[] = [];
    let w = 0;
    let full = false;
    for (const s of word.segs) {
      if (full) {
        rest.push(s);
        continue;
      }
      let taken = "";
      for (const ch of s.text) {
        const cw = fonts.width(s.font, ch, size);
        if (!full && w + cw <= maxW) {
          taken += ch;
          w += cw;
        } else {
          full = true;
        }
      }
      if (taken) head.push({ text: taken, font: s.font });
      const left = s.text.slice(taken.length);
      if (left) rest.push({ text: left, font: s.font });
    }
    const width = (segs: Seg[]) => segs.reduce((a, s) => a + fonts.width(s.font, s.text, size), 0);
    return [{ segs: head, width: width(head) }, { segs: rest, width: width(rest) }];
  }

  function drawLine(
    els: PageElement[],
    line: Line,
    x0: number,
    y: number,
    maxW: number,
    size: number,
    opts: { justify: boolean; align?: "left" | "center"; tone?: "ink" | "muted" },
  ) {
    const space = fonts.width("regular", " ", size);
    const total = line.words.reduce((a, w) => a + w.width, 0);
    let gap = space;
    if (opts.justify && !line.hard && line.words.length > 1) {
      const g = (maxW - total) / (line.words.length - 1);
      if (g <= space * 3) gap = g;
    }
    let x = x0;
    if (opts.align === "center") x = x0 + (maxW - (total + space * (line.words.length - 1))) / 2;
    for (const w of line.words) {
      let sx = x;
      for (const s of w.segs) {
        els.push({ t: "text", x: sx, y, size, font: s.font, text: s.text, tone: opts.tone ?? "ink" });
        sx += fonts.width(s.font, s.text, size);
      }
      x += w.width + gap;
    }
  }

  // ---- pages ----------------------------------------------------------------
  let currentRecordLabel: string | null = null;
  function newPage(kind: PlannedPage["kind"], rec: BookRecordSource | null, opts: { head?: boolean } = {}) {
    const index = pages.length + 1;
    const page: PlannedPage = {
      index,
      folio: kind === "title" || kind === "blank" ? null : index,
      kind,
      itemId: rec?.itemId ?? null,
      archiveId: rec?.archiveId ?? null,
      elements: [],
    };
    pages.push(page);
    if (page.folio !== null) {
      const folio = String(page.folio);
      const fw = fonts.width("regular", folio, 9);
      page.elements.push({ t: "text", x: (W - fw) / 2, y: H - L.folioFromBottom, size: 9, font: "regular", text: folio, tone: "muted" });
      if (opts.head !== false) {
        const label = printableText(index % 2 === 0 ? meta.title : currentRecordLabel ?? meta.title);
        const lines = breakLines([{ text: label, italic: true, bold: false }], 9, contentW);
        drawLine(page.elements, lines[0], leftOf(index), L.headBaseline, contentW, 9, { justify: false, align: "center", tone: "muted" });
      }
    }
    return page;
  }

  /** Writes wrapped text, returns the new cursor (top of next line). */
  function writeBlock(
    page: PlannedPage,
    inlines: Inline[],
    top: number,
    size: number,
    leading: number,
    opts: { align?: "left" | "center"; tone?: "ink" | "muted"; indent?: number } = {},
  ) {
    const x0 = leftOf(page.index) + (opts.indent ?? 0);
    const w = contentW - (opts.indent ?? 0) * 2;
    let y = top;
    for (const line of breakLines(inlines, size, w)) {
      y += leading;
      drawLine(page.elements, line, x0, y - (leading - size) * 0.35, w, size, { justify: false, align: opts.align, tone: opts.tone });
    }
    return y;
  }

  function placeImage(page: PlannedPage, img: BookImage, box: { x: number; y: number; w: number; h: number }, rec: BookRecordSource) {
    const captionH = 16;
    const availH = Math.max(40, box.h - captionH);
    const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 0.77;
    let w = box.w;
    let h = w / ratio;
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    const x = box.x + (box.w - w) / 2;
    const y = box.y + (availH - h) / 2;
    const dpi = img.width > 0 ? Math.round(Math.min(img.width / (w / 72), img.height / (h / 72))) : 0;
    page.elements.push({ t: "image", x, y, w, h, image: img, dpi });
    const caption = printableText(img.label || "");
    if (caption) {
      const cw = fonts.width("italic", caption, L.captionSize);
      page.elements.push({ t: "text", x: box.x + (box.w - cw) / 2, y: y + h + 12, size: L.captionSize, font: "italic", text: caption, tone: "muted" });
    }
    if (!img.width || !img.height) {
      warnings.push({ level: "warning", archiveId: rec.archiveId, itemId: rec.itemId, message: `${img.label || "Scan"}: image size unknown, resolution could not be checked.` });
    } else if (dpi < PRINT_DPI_MIN) {
      warnings.push({ level: "warning", archiveId: rec.archiveId, itemId: rec.itemId, message: `${img.label || "Scan"} prints at about ${dpi} DPI (below ${PRINT_DPI_MIN}); it may look soft in print.` });
    } else if (dpi < PRINT_DPI_GOOD) {
      warnings.push({ level: "info", archiveId: rec.archiveId, itemId: rec.itemId, message: `${img.label || "Scan"} prints at about ${dpi} DPI (under the ideal ${PRINT_DPI_GOOD}).` });
    }
  }

  function recordHeader(page: PlannedPage, rec: BookRecordSource): number {
    let y = L.marginTop - 6;
    const date = rec.dateLabel ?? rec.title ?? "Undated";
    y = writeBlock(page, [{ text: date, italic: false, bold: true }], y, 17, 22, { align: "center" });
    const parties = [rec.author ? `From ${rec.author}` : null, rec.recipient ? `to ${rec.recipient}` : null].filter(Boolean).join(" ");
    if (parties) y = writeBlock(page, [{ text: parties, italic: true, bold: false }], y, 10.5, 15, { align: "center", tone: "muted" });
    const meta2 = [rec.location, rec.archiveId].filter(Boolean).join("  ·  ");
    y = writeBlock(page, [{ text: meta2, italic: false, bold: false }], y, 9, 14, { align: "center", tone: "muted" });
    y += 10;
    page.elements.push({ t: "rule", x: leftOf(page.index) + contentW * 0.35, y, w: contentW * 0.3 });
    return y + 16;
  }

  // ---- title page -----------------------------------------------------------
  if (meta.settings.titlePage) {
    const p = newPage("title", null);
    let y = H * 0.34;
    y = writeBlock(p, [{ text: meta.title, italic: false, bold: true }], y, 26, 34, { align: "center" });
    if (meta.subtitle) y = writeBlock(p, [{ text: meta.subtitle, italic: true, bold: false }], y + 6, 15, 21, { align: "center", tone: "muted" });
    newPage("blank", null);
  }

  // ---- records ----------------------------------------------------------------
  for (const rec of records) {
    currentRecordLabel = rec.dateLabel ?? rec.title ?? rec.archiveId;
    let headerDone = false;

    // FIRST — original letter pages
    const perPage = meta.settings.scansPerPage === 2 ? 2 : 1;
    for (let i = 0; i < rec.scans.length; i += perPage) {
      const page = newPage("scan", rec, { head: headerDone });
      let top = L.marginTop;
      if (!headerDone) {
        top = recordHeader(page, rec);
        headerDone = true;
      }
      const x0 = leftOf(page.index);
      const group = rec.scans.slice(i, i + perPage);
      const gap = 18;
      const slotW = group.length === 2 ? (contentW - gap) / 2 : contentW;
      group.forEach((img, k) => placeImage(page, img, { x: x0 + k * (slotW + gap), y: top, w: slotW, h: bottom - top }, rec));
    }

    // SECOND — original envelope (front, then reverse) — never substituted
    for (let i = 0; i < rec.envelopes.length; i += 2) {
      const page = newPage("envelope", rec, { head: headerDone });
      let top = L.marginTop;
      if (!headerDone) {
        top = recordHeader(page, rec);
        headerDone = true;
      }
      top = writeBlock(page, [{ text: "Envelope", italic: true, bold: false }], top - 8, 10, 14, { align: "center", tone: "muted" }) + 8;
      const group = rec.envelopes.slice(i, i + 2);
      const gap = 20;
      const slotH = group.length === 2 ? (bottom - top - gap) / 2 : Math.min(bottom - top, (bottom - top) * 0.6);
      group.forEach((img, k) => placeImage(page, img, { x: leftOf(page.index), y: top + k * (slotH + gap), w: contentW, h: slotH }, rec));
    }

    // THIRD — full transcription, flowing across pages
    const blocks = parseTranscription(rec.transcription);
    if (blocks.length) {
      let page = newPage("text", rec, { head: headerDone });
      let y = L.marginTop;
      if (!headerDone) {
        y = recordHeader(page, rec);
        headerDone = true;
      }
      const label = rec.transcriptionVerified ? "Transcription" : "Transcription · not yet human-verified";
      y = writeBlock(page, [{ text: label, italic: true, bold: false }], y - 8, 10, 14, { align: "center", tone: "muted" }) + 12;

      blocks.forEach((block, bi) => {
        const indent = block.kind === "quote" ? 24 : block.kind === "item" ? 12 : 0;
        const size = block.kind === "heading" ? 12.5 : L.body;
        const inl = block.kind === "heading" ? block.inlines.map((i) => ({ ...i, bold: true })) : block.inlines;
        const x0 = () => leftOf(page.index) + indent;
        const w = contentW - indent * (block.kind === "quote" ? 2 : 1);
        const lines = breakLines(inl, size, w);
        if (bi > 0) y += L.paraGap;
        let at = 0;
        while (at < lines.length) {
          const room = Math.floor((bottom - y) / L.leading + 0.001);
          const remaining = lines.length - at;
          let take = Math.min(room, remaining);
          if (take < remaining) {
            // No lone first line at the foot of a page, no lone last line at the head.
            if (take === 1 && remaining > 1) take = 0;
            if (remaining - take === 1 && take >= 2) take -= 1;
            if (block.kind === "heading") take = 0;
          }
          if (take <= 0) {
            page = newPage("text", rec);
            y = L.marginTop;
            continue;
          }
          for (let k = 0; k < take; k++) {
            y += L.leading;
            drawLine(page.elements, lines[at + k], x0(), y - 4, w, size, { justify: true });
          }
          at += take;
          if (at < lines.length) {
            page = newPage("text", rec);
            y = L.marginTop;
          }
        }
      });
    }

    if (!headerDone) {
      const page = newPage("text", rec, { head: false });
      const y = recordHeader(page, rec);
      writeBlock(page, [{ text: "No scans or transcription are available for this record.", italic: true, bold: false }], y, 10, 14, { align: "center", tone: "muted" });
    }
  }

  if (fonts.missing.size) {
    warnings.push({ level: "warning", archiveId: null, itemId: null, message: `Some characters are not in the book typeface and print as “?”: ${[...fonts.missing].join(" ")}` });
  }
  return { widthPt: W, heightPt: H, pages, warnings };
}
