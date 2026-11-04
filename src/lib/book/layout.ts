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
  type BookEntry,
  type BookPageSource,
  type BookRecordSource,
  type BookWarning,
  type FontKey,
  type PageElement,
  type PlannedPage,
  type BookChapterSource,
  type CoverDoc,
  type Tone,
} from "./types";
import { containRect, coverRect, sortedBoxes, PAGE_W, PAGE_H } from "./templates";
import { themeFor } from "./themes";
import { coverSize, gutterIn, printerFor } from "./printers";

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

/**
 * Lays out the whole book. Printer profiles can widen the inside margin as the
 * page count grows, so the plan is recomputed until the gutter is stable, then
 * blank pages are added at the end to meet the printer's page-count rule.
 */
export function buildPlan(meta: BookMeta, entries: BookEntry[], fonts: BookFonts): BookPlan {
  const profile = printerFor(meta.settings.printer);
  let gutter = 0;
  let plan = planOnce(meta, entries, fonts, 0);
  for (let i = 0; i < 4; i++) {
    const need = gutterIn(profile, plan.pages.length) * 72;
    if (need === gutter) break;
    gutter = need;
    plan = planOnce(meta, entries, fonts, gutter);
  }
  let padded = 0;
  while (profile.pageMultiple > 1 && plan.pages.length % profile.pageMultiple !== 0) {
    plan.pages.push({ index: plan.pages.length + 1, folio: null, kind: "blank", itemId: null, archiveId: null, elements: [] });
    padded++;
  }
  plan.paddedPages = padded;
  return plan;
}

function planOnce(meta: BookMeta, entries: BookEntry[], fonts: BookFonts, gutterPt: number): BookPlan {
  const W = meta.trimWidthIn * 72;
  const H = meta.trimHeightIn * 72;
  const pages: PlannedPage[] = [];
  const warnings: BookWarning[] = [];
  const theme = themeFor(meta.settings.theme);
  const profile = printerFor(meta.settings.printer);
  const safe = profile.safeIn * 72;
  const bleed = profile.bleedIn * 72;
  const headBaseline = Math.max(theme.headBaseline, safe + 10);
  const folioFromBottom = Math.max(theme.folioFromBottom, safe + 4);
  const L = {
    ...LAYOUT,
    headBaseline,
    folioFromBottom,
    marginTop: Math.max(theme.marginTop, headBaseline + 22),
    marginBottom: Math.max(theme.marginBottom, folioFromBottom + 30),
    marginInside: Math.max(theme.marginInside, safe) + gutterPt,
    marginOutside: Math.max(theme.marginOutside, safe),
    body: theme.body,
    leading: theme.leading,
    paraGap: theme.paraGap,
    captionSize: theme.captionSize,
  };
  const settings = meta.settings;
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
    opts: { justify: boolean; align?: "left" | "center" | "right"; tone?: "ink" | "muted" | "note" },
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
    if (opts.align === "right") x = x0 + (maxW - (total + space * (line.words.length - 1)));
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
  let currentChapter: string | null = null;
  function newPage(kind: PlannedPage["kind"], rec: { itemId: string; archiveId: string | null } | null, opts: { head?: boolean; folio?: boolean } = {}) {
    const index = pages.length + 1;
    const page: PlannedPage = {
      index,
      folio: kind === "title" || kind === "blank" || opts.folio === false ? null : index,
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
        let label = printableText(index % 2 === 0 ? currentChapter ?? meta.title : currentRecordLabel ?? meta.title);
        if (theme.headCaps) label = label.toUpperCase();
        const hs = theme.headCaps ? 8 : 9;
        const lines = breakLines([{ text: label, italic: !theme.headCaps, bold: false }], hs, contentW);
        drawLine(page.elements, lines[0], leftOf(index), L.headBaseline, contentW, hs, { justify: false, align: "center", tone: "muted" });
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
    opts: { align?: "left" | "center" | "right"; tone?: "ink" | "muted" | "note"; indent?: number } = {},
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
    dpiWarning(img, dpi, rec.archiveId, rec.itemId);
  }

  function dpiWarning(img: BookImage, dpi: number, archiveId: string | null, itemId: string) {
    if (!img.width || !img.height) {
      warnings.push({ level: "warning", archiveId, itemId, message: `${img.label || "Scan"}: image size unknown, resolution could not be checked.` });
    } else if (dpi < PRINT_DPI_MIN) {
      warnings.push({ level: "warning", archiveId, itemId, message: `${img.label || "Scan"} prints at about ${dpi} DPI (below ${PRINT_DPI_MIN}); it may look soft in print.` });
    } else if (dpi < PRINT_DPI_GOOD) {
      warnings.push({ level: "info", archiveId, itemId, message: `${img.label || "Scan"} prints at about ${dpi} DPI (under the ideal ${PRINT_DPI_GOOD}).` });
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
    if (settings.front?.colophon) colophon();
    else newPage("blank", null);
  } else if (settings.front?.colophon) colophon();

  /** Pads with an intentionally blank page so the next page is right-hand (odd). */
  function toRightHand() {
    if (pages.length % 2 === 1) newPage("blank", null);
  }
  /** Pads so the next page is left-hand (even). */
  function toLeftHand() {
    if (pages.length % 2 === 0) newPage("blank", null);
  }

  /** Copyright / colophon page: only the text the editor wrote, set small near the foot. */
  function colophon() {
    const p = newPage("front", null, { folio: false });
    const lines = (settings.front?.colophonText ?? "").replace(/\r\n?/g, "\n").split("\n");
    const h = lines.length * 13;
    let y = Math.max(L.marginTop, H * 0.62 - h / 2);
    for (const line of lines) {
      if (!line.trim()) {
        y += 8;
        continue;
      }
      y = writeBlock(p, [{ text: line.trim(), italic: false, bold: false }], y, 9, 13, { align: "center", tone: "muted" });
    }
  }

  const dedication = settings.front?.dedication?.trim();
  if (dedication) {
    toRightHand();
    const p = newPage("front", null, { folio: false });
    const paras = dedication.replace(/\r\n?/g, "\n").split("\n");
    let y = H * 0.32;
    for (const para of paras) y = para.trim() ? writeBlock(p, [{ text: para.trim(), italic: true, bold: false }], y, 13, 20, { align: "center", indent: 50 }) : y + 10;
  }

  // ---- table of contents: reserved now (its length depends only on the entry list), filled at the end
  type TocLine = { level: 0 | 1; text: string; itemId: string };
  const tocLines: TocLine[] = [];
  if (settings.toc?.enabled) {
    for (const e of entries) {
      if (e.type === "chapter") tocLines.push({ level: 0, text: e.doc.title || "Untitled chapter", itemId: e.itemId });
      else if (e.type === "page") {
        if (e.doc.flow?.heading?.trim()) tocLines.push({ level: 0, text: e.doc.flow.heading.trim(), itemId: e.itemId });
      } else if (settings.toc.records) {
        tocLines.push({ level: 1, text: [e.archiveId, e.dateLabel ?? "Undated", e.author ? `from ${e.author}` : null].filter(Boolean).join(" · "), itemId: e.itemId });
      }
    }
  }
  const tocPages: Array<{ page: PlannedPage; lines: Array<TocLine & { y: number }> }> = [];
  if (tocLines.length) {
    toRightHand();
    let page = newPage("toc", null, { folio: false });
    let y = writeBlock(page, [{ text: "Contents", italic: false, bold: false }], L.marginTop, 20, 26, { align: "center" }) + 22;
    let cur: (typeof tocPages)[number] = { page, lines: [] };
    tocPages.push(cur);
    for (const line of tocLines) {
      const lh = line.level === 0 ? 22 : 16;
      if (y + lh > bottom) {
        page = newPage("toc", null, { folio: false });
        cur = { page, lines: [] };
        tocPages.push(cur);
        y = L.marginTop;
      }
      y += lh;
      cur.lines.push({ ...line, y });
    }
  }
  if (pages.length) toRightHand();

  /** Identifying lines under the envelope; only catalogued facts, nothing invented. */
  function introLines(rec: BookRecordSource) {
    const lines: Array<{ text: string; size: number; leading: number; italic: boolean; bold: boolean; tone: "ink" | "muted"; gapBefore: number }> = [];
    const add = (text: string | null, size: number, leading: number, italic: boolean, bold: boolean, tone: "ink" | "muted", gapBefore = 0) => {
      if (text) lines.push({ text, size, leading, italic, bold, tone, gapBefore });
    };
    add(rec.author ? `A Letter from ${rec.author}` : rec.title || "A Letter", 20, 26, false, false, "ink");
    add(rec.recipient ? `To ${rec.recipient}` : null, 13, 19, true, false, "ink");
    add(rec.dateLabel, 12, 18, false, false, "ink", 8);
    add(rec.origin ?? rec.location, 11, 16, true, false, "muted");
    add(rec.destination ? `To ${rec.destination}` : null, 11, 16, true, false, "muted");
    add(rec.archiveId, 8, 14, false, false, "muted", 10);
    return lines;
  }
  const introHeight = (rec: BookRecordSource) => introLines(rec).reduce((h, l) => h + l.leading + l.gapBefore, 0);
  function writeIntro(page: PlannedPage, rec: BookRecordSource, top: number) {
    let y = top;
    for (const l of introLines(rec)) {
      y = writeBlock(page, [{ text: l.text, italic: l.italic, bold: l.bold }], y + l.gapBefore, l.size, l.leading, { align: "center", tone: l.tone });
    }
    return y;
  }

  /** Fits an image inside a box without cropping; returns its printed size. */
  const fit = (img: BookImage, w: number, h: number) => {
    const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1.6;
    return w / ratio > h ? { w: h * ratio, h } : { w, h: w / ratio };
  };
  const LEGIBLE_LONG_SIDE = 4.25 * 72;

  // ---- records ----------------------------------------------------------------
  for (const entry of entries) {
    if (entry.type === "page") {
      renderCustom(entry);
      continue;
    }
    if (entry.type === "chapter") {
      renderChapter(entry);
      continue;
    }
    const rec = entry;
    currentRecordLabel = rec.dateLabel ?? rec.title ?? rec.archiveId;
    let headerDone = false;

    // Facing pages: introduction, then each scan on a left page with its own transcription opposite.
    const pageTexts = rec.pageTexts;
    if (settings.facing && rec.scans.length && pageTexts && rec.scans.some((s) => pageTexts[s.fileId]?.trim())) {
      envelopeIntro(rec, false);
      rec.scans.forEach((img, si) => {
        toLeftHand();
        const sp = newPage("scan", rec);
        placeImage(sp, img, { x: leftOf(sp.index), y: L.marginTop, w: contentW, h: bottom - L.marginTop }, rec);
        const tp = newPage("text", rec);
        const label = `${img.label || `Page ${si + 1}`} · ${rec.transcriptionVerified ? "Transcription" : "Transcription, not yet human-verified"}`;
        const y = writeBlock(tp, [{ text: label, italic: true, bold: false }], L.marginTop - 8, 10, 14, { align: "center", tone: "muted" }) + 12;
        const blocks = parseTranscription(pageTexts[img.fileId] ?? "");
        if (blocks.length) flowBlocks(blocks, tp, y, rec, "ink");
        else writeBlock(tp, [{ text: "No transcription for this page.", italic: true, bold: false }], y, 10, 14, { align: "center", tone: "muted" });
      });
      continue;
    }

    if (meta.settings.envelopeFirst || settings.facing) {
      envelopeIntro(rec);
      // 3 — each original letter page on its own full page
      for (const img of rec.scans) {
        const sp = newPage("scan", rec);
        placeImage(sp, img, { x: leftOf(sp.index), y: L.marginTop, w: contentW, h: bottom - L.marginTop }, rec);
      }
      headerDone = true;
    }

    // Original (non-envelope-first) order: letter pages, then envelope.
    const perPage = meta.settings.scansPerPage === 2 ? 2 : 1;
    const legacy = !meta.settings.envelopeFirst && !settings.facing;
    for (let i = 0; legacy && i < rec.scans.length; i += perPage) {
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
    for (let i = 0; legacy && i < rec.envelopes.length; i += 2) {
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

      flowBlocks(blocks, page, y, rec, "ink");
    }

    if (!headerDone) {
      const page = newPage("text", rec, { head: false });
      const y = recordHeader(page, rec);
      writeBlock(page, [{ text: "No scans or transcription are available for this record.", italic: true, bold: false }], y, 10, 14, { align: "center", tone: "muted" });
    }
  }

  function envelopeIntro(rec: BookRecordSource, reverse = true) {
    toRightHand();
    const page = newPage("envelope", rec, { folio: false });
    const infoH = introHeight(rec);
    const x0 = leftOf(page.index);
    if (!rec.envelopes.length) {
      writeIntro(page, rec, H * 0.36);
    } else {
      const gap = 22;
      const areaTop = L.marginTop;
      const areaH = bottom - areaTop - infoH - 28;
      const [front, back] = rec.envelopes;
      let onFirst = [front];
      let stacked = true;
      if (back) {
        // Try both on one page: stacked (landscape envelopes) or side by side (portrait).
        const st = [fit(front, contentW, (areaH - gap) / 2 - 16), fit(back, contentW, (areaH - gap) / 2 - 16)];
        const sb = [fit(front, (contentW - gap) / 2, areaH - 16), fit(back, (contentW - gap) / 2, areaH - 16)];
        const area = (a: { w: number; h: number }[]) => a.reduce((s2, b) => s2 + b.w * b.h, 0);
        const best = area(st) >= area(sb) ? st : sb;
        stacked = best === st;
        if (best.every((b) => Math.max(b.w, b.h) >= LEGIBLE_LONG_SIDE)) onFirst = [front, back];
      }
      if (onFirst.length === 2) {
        if (stacked) {
          const slot = (areaH - gap) / 2;
          onFirst.forEach((img, k) => placeImage(page, img, { x: x0, y: areaTop + k * (slot + gap), w: contentW, h: slot }, rec));
        } else {
          const slot = (contentW - gap) / 2;
          onFirst.forEach((img, k) => placeImage(page, img, { x: x0 + k * (slot + gap), y: areaTop, w: slot, h: areaH }, rec));
        }
      } else {
        placeImage(page, front, { x: x0, y: areaTop, w: contentW, h: areaH }, rec);
      }
      writeIntro(page, rec, bottom - infoH);
      // Envelopes that did not fit legibly get their own unnumbered pages.
      for (const img of rec.envelopes.slice(onFirst.length)) {
        const extra = newPage("envelope", rec, { folio: false });
        placeImage(extra, img, { x: leftOf(extra.index), y: L.marginTop, w: contentW, h: bottom - L.marginTop }, rec);
      }
    }
    // blank reverse(s) so the first handwritten page opens on the right
    if (reverse) toRightHand();
  }

  // ---- shared paragraph flow (transcriptions and research essays) -------------
  function flowBlocks(blocks: ReturnType<typeof parseTranscription>, startPage: PlannedPage, startY: number, owner: { itemId: string; archiveId: string | null }, tone: "ink" | "note") {
    let page = startPage;
    let y = startY;
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
          page = newPage(startPage.kind, owner);
          y = L.marginTop;
          continue;
        }
        for (let k = 0; k < take; k++) {
          y += L.leading;
          drawLine(page.elements, lines[at + k], x0(), y - 4, w, size, { justify: true, tone });
        }
        at += take;
        if (at < lines.length) {
          page = newPage(startPage.kind, owner);
          y = L.marginTop;
        }
      }
    });
  }

  // ---- chapters (Phase 3) -------------------------------------------------------
  function renderChapter(ch: BookChapterSource) {
    const title = ch.doc.title?.trim() || "Untitled chapter";
    currentChapter = title;
    currentRecordLabel = title;
    toRightHand();
    const p = newPage("chapter", { itemId: ch.itemId, archiveId: null }, { folio: false });
    let y = H * 0.3;
    y = writeBlock(p, [{ text: title, italic: false, bold: false }], y, theme.chapterSize, theme.chapterSize * 1.3, { align: "center" });
    if (ch.doc.subtitle?.trim()) y = writeBlock(p, [{ text: ch.doc.subtitle.trim(), italic: true, bold: false }], y + 4, 13, 19, { align: "center", tone: "muted" });
    if (theme.ornament) y = writeBlock(p, [{ text: theme.ornament, italic: false, bold: false }], y + 14, 16, 22, { align: "center", tone: "muted" });
    else {
      y += 18;
      p.elements.push({ t: "rule", x: leftOf(p.index) + contentW * 0.42, y, w: contentW * 0.16 });
    }
    if (ch.doc.epigraph?.trim()) {
      y += 26;
      for (const para of ch.doc.epigraph.trim().split(/\n{2,}/)) y = writeBlock(p, [{ text: para.replace(/\n/g, " "), italic: true, bold: false }], y, 11.5, 17, { align: "center", indent: 56 }) + 4;
      if (ch.doc.epigraphSource?.trim()) writeBlock(p, [{ text: `— ${ch.doc.epigraphSource.trim()}`, italic: false, bold: false }], y + 2, 9.5, 14, { align: "right", indent: 56, tone: "muted" });
    }
  }

  // ---- custom pages (Phase 2) ------------------------------------------------
  function renderCustom(src0: BookPageSource) {
    // Templates are drawn on an 8.5 × 11 in page; other trims scale them proportionally.
    const sx = W / PAGE_W;
    const sy = H / PAGE_H;
    const src: BookPageSource =
      sx === 1 && sy === 1
        ? src0
        : { ...src0, doc: { ...src0.doc, boxes: src0.doc.boxes.map((b) => ({ ...b, x: b.x * sx, y: b.y * sy, w: b.w * sx, h: b.h * sy })) } };
    const doc = src.doc;
    const owner = { itemId: src.itemId, archiveId: null };
    const label = doc.name || "Custom page";
    if (doc.flow) {
      currentRecordLabel = doc.flow.heading?.trim() || meta.title;
      const page = newPage("custom", owner, { head: false, folio: doc.folio });
      let y = L.marginTop;
      if (doc.flow.heading?.trim()) y = writeBlock(page, [{ text: doc.flow.heading.trim(), italic: false, bold: false }], y, 18, 24, { align: "center" });
      y = writeBlock(page, [{ text: "Modern commentary", italic: true, bold: false }], y + 2, 8.5, 13, { align: "center", tone: "note" }) + 10;
      const blocks = parseTranscription(plainToHtml(doc.flow.text));
      if (!blocks.length) warnings.push({ level: "warning", archiveId: null, itemId: src.itemId, message: `${label}: the essay has no text yet.` });
      flowBlocks(blocks, page, y, owner, "note");
      return;
    }
    const page = newPage("custom", owner, { head: false, folio: doc.folio });
    for (const box of sortedBoxes(doc.boxes)) {
      if (box.kind === "text") {
        const st = TEXT_STYLES[box.style] ?? TEXT_STYLES.body;
        let y = box.y;
        if (box.style === "note") {
          y += 12;
          page.elements.push({ t: "text", x: box.x, y: y - 2, size: 8, font: "italic", text: "Editor’s note", tone: "note" });
          y += 2;
        }
        const italic = box.italic ?? st.italic;
        const bold = box.bold ?? false;
        const paras = box.text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
        let overflow = false;
        paras.forEach((para, pi) => {
          if (overflow) return;
          if (pi > 0) y += st.leading * 0.45;
          const inl = para.split("\n").flatMap((t, k) => (k ? [{ text: "", italic, bold, br: true }, { text: t, italic, bold }] : [{ text: t, italic, bold }]));
          for (const line of breakLines(inl, st.size, box.w)) {
            if (y + st.leading > box.y + box.h + 0.5) {
              overflow = true;
              break;
            }
            y += st.leading;
            drawLine(page.elements, line, box.x, y - (st.leading - st.size) * 0.35, box.w, st.size, { justify: box.align === "left" && box.style === "body", align: box.align, tone: st.tone });
          }
        });
        if (overflow) warnings.push({ level: "warning", archiveId: null, itemId: src.itemId, message: `${label}: some text does not fit in its box and is cut off. Make the box larger or the text shorter.` });
        continue;
      }
      const img = src.images[box.id] ?? null;
      if (!img) {
        warnings.push({ level: "warning", archiveId: null, itemId: src.itemId, message: box.ref ? `${label}: an image could not be found and is left out.` : `${label}: an image box is empty.` });
        continue;
      }
      const captionH = box.caption?.trim() && box.mode !== "bleed" ? 18 : 0;
      const area = box.mode === "bleed" ? { x: -bleed, y: -bleed, w: W + bleed * 2, h: H + bleed * 2 } : { x: box.x, y: box.y, w: box.w, h: Math.max(20, box.h - captionH) };
      const r = box.mode === "fit" ? containRect(img.width, img.height, area) : coverRect(img.width, img.height, area);
      const dpi = img.width > 0 ? Math.round(Math.min(img.width / (r.w / 72), img.height / (r.h / 72))) : 0;
      page.elements.push({ t: "image", ...r, image: img, dpi, ...(box.mode === "fit" ? {} : { clip: area }) });
      dpiWarning(img, dpi, null, src.itemId);
      if (captionH) {
        const capTop = (box.mode === "fit" ? r.y + r.h : area.y + area.h) + 2;
        let cy = capTop;
        for (const line of breakLines([{ text: box.caption!.trim(), italic: true, bold: false }], L.captionSize, area.w)) {
          cy += 12;
          drawLine(page.elements, line, area.x, cy - 1, area.w, L.captionSize, { justify: false, align: "center", tone: "muted" });
        }
      }
    }
  }

  // ---- fill the reserved contents pages now that every page number is known
  for (const tp of tocPages) {
    const x0 = leftOf(tp.page.index);
    for (const line of tp.lines) {
      const target = pages.find((pg) => pg.itemId === line.itemId);
      if (!target) continue;
      const num = String(target.index);
      const size = line.level === 0 ? 12 : 10;
      const font: FontKey = line.level === 0 ? "regular" : "italic";
      const indent = line.level === 0 ? 0 : 18;
      const numW = fonts.width("regular", num, size);
      const room = contentW - indent - numW - 24;
      let text = printableText(line.text);
      while (text.length > 3 && fonts.width(font, text, size) > room) text = `${text.slice(0, -2).trimEnd()}…`;
      const tw = fonts.width(font, text, size);
      tp.page.elements.push({ t: "text", x: x0 + indent, y: line.y, size, font, text, tone: "ink" });
      const dotW = fonts.width("regular", " .", size);
      const dots = Math.max(0, Math.floor((contentW - indent - tw - numW - 12) / dotW));
      if (dots > 0) {
        const leader = " .".repeat(dots);
        const lw = fonts.width("regular", leader, size);
        tp.page.elements.push({ t: "text", x: x0 + contentW - numW - 6 - lw, y: line.y, size, font: "regular", text: leader, tone: "muted" });
      }
      tp.page.elements.push({ t: "text", x: x0 + contentW - numW, y: line.y, size, font: "regular", text: num, tone: "ink" });
    }
  }

  if (fonts.missing.size) {
    warnings.push({ level: "warning", archiveId: null, itemId: null, message: `Some characters are not in the book typeface and print as “?”: ${[...fonts.missing].join(" ")}` });
  }
  const t = theme.tones;
  return {
    widthPt: W,
    heightPt: H,
    pages,
    warnings,
    bleedPt: bleed,
    margins: { top: L.marginTop, bottom: L.marginBottom, inside: L.marginInside, outside: L.marginOutside },
    tones: { ink: t.ink, muted: t.muted, note: t.note, paper: t.paper },
  };
}

// ---- cover (Phase 3) -----------------------------------------------------------

/**
 * Lays out the full cover spread (back, spine, front) as one page including
 * bleed. Spine width follows the printer profile and the interior page count.
 */
export function buildCoverPlan(meta: BookMeta, cover: CoverDoc, image: BookImage | null, interiorPages: number, fonts: BookFonts): BookPlan & { spineIn: number } {
  const profile = printerFor(meta.settings.printer);
  const theme = themeFor(meta.settings.theme);
  const W = meta.trimWidthIn * 72;
  const H = meta.trimHeightIn * 72;
  const size = coverSize(profile, meta.trimWidthIn, meta.trimHeightIn, interiorPages);
  const b = size.bleedPt;
  const S = size.spinePt;
  const safe = Math.max(profile.safeIn * 72, 36);
  const els: PageElement[] = [];
  const warnings: BookWarning[] = [];
  const back = { x: b, y: b, w: W, h: H };
  const spine = { x: b + W, y: b, w: S, h: H };
  const front = { x: b + W + S, y: b, w: W, h: H };
  const dark = cover.template !== "classic";
  const textTone: Tone = dark ? "paper" : "ink";
  const mutedTone: Tone = dark ? "paper" : "muted";

  const wrap = (text: string, font: FontKey, sz: number, maxW: number) => {
    const out: string[] = [];
    for (const para of printableText(text).replace(/\r\n?/g, "\n").split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && fonts.width(font, next, sz) > maxW) {
          out.push(line);
          line = word;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  };
  const centered = (text: string, panel: { x: number; w: number }, top: number, sz: number, lead: number, font: FontKey, tone: Tone) => {
    let y = top;
    for (const line of wrap(text, font, sz, panel.w - safe * 2)) {
      y += lead;
      if (!line) continue;
      els.push({ t: "text", x: panel.x + (panel.w - fonts.width(font, line, sz)) / 2, y, size: sz, font, text: line, tone });
    }
    return y;
  };

  if (dark) els.push({ t: "fill", x: 0, y: 0, w: size.widthPt, h: size.heightPt, color: theme.tones.cover });

  // Front
  if (cover.template === "photo" && image) {
    const area = { x: front.x, y: 0, w: front.w + b, h: size.heightPt };
    const r = coverRect(image.width, image.height, area);
    const dpi = image.width > 0 ? Math.round(Math.min(image.width / (r.w / 72), image.height / (r.h / 72))) : 0;
    els.push({ t: "image", ...r, image, dpi, clip: area });
    els.push({ t: "fill", x: front.x, y: b + H * 0.66, w: front.w + b, h: H * 0.34 + b, color: theme.tones.cover });
    let y = centered(cover.title || meta.title, front, b + H * 0.69, 28, 34, "bold", "paper");
    if (cover.subtitle) y = centered(cover.subtitle, front, y + 4, 14, 19, "italic", "paper");
    if (cover.author) centered(cover.author, front, b + H - safe - 30, 13, 18, "regular", "paper");
    if (dpi && dpi < 200) warnings.push({ level: "warning", archiveId: null, itemId: null, message: `Cover photo prints at about ${dpi} DPI (below 200); it may look soft.` });
  } else {
    let y = centered(cover.title || meta.title, front, b + H * 0.16, 30, 37, "bold", textTone);
    if (cover.subtitle) y = centered(cover.subtitle, front, y + 6, 15, 21, "italic", mutedTone);
    if (theme.ornament && !image) centered(theme.ornament, front, y + 16, 18, 24, "regular", mutedTone);
    if (image) {
      const box = { x: front.x + safe + 18, y: b + H * 0.38, w: W - (safe + 18) * 2, h: H * 0.4 };
      const r = containRect(image.width, image.height, box);
      const dpi = image.width > 0 ? Math.round(Math.min(image.width / (r.w / 72), image.height / (r.h / 72))) : 0;
      els.push({ t: "image", ...r, image, dpi });
      if (dpi && dpi < 200) warnings.push({ level: "warning", archiveId: null, itemId: null, message: `Cover photo prints at about ${dpi} DPI (below 200); it may look soft.` });
    }
    if (cover.author) centered(cover.author, front, b + H - safe - 34, 14, 19, "regular", textTone);
  }

  // Back
  if (cover.template === "photo") els.push({ t: "fill", x: 0, y: 0, w: back.x + back.w + S, h: size.heightPt, color: theme.tones.cover });
  if (cover.backText.trim()) {
    let y = b + H * 0.18;
    for (const para of cover.backText.trim().split(/\n{2,}/)) y = centered(para.replace(/\n/g, " "), { x: back.x + 24, w: back.w - 48 }, y, 11, 16, "regular", cover.template === "photo" ? "paper" : textTone) + 8;
  }

  // Spine
  const spineText = [cover.title || meta.title, cover.author].filter(Boolean).join("   ·   ");
  if (cover.spineText && spineText) {
    if (size.spineIn < profile.spineTextMinIn) {
      warnings.push({ level: "info", archiveId: null, itemId: null, message: `The spine is ${size.spineIn.toFixed(3)} in wide; ${profile.name.split(" —")[0]} allows spine text from ${profile.spineTextMinIn} in, so it is left off.` });
    } else {
      let sz = Math.min(14, S * 0.5);
      while (sz > 6 && fonts.width("regular", printableText(spineText), sz) > H - safe * 2) sz -= 0.5;
      const len = fonts.width("regular", printableText(spineText), sz);
      els.push({ t: "text", x: spine.x + S / 2 - sz * 0.33, y: b + (H - len) / 2, size: sz, font: "regular", text: printableText(spineText), tone: cover.template === "classic" ? "ink" : "paper", rotate: true });
    }
  }

  if (fonts.missing.size) warnings.push({ level: "warning", archiveId: null, itemId: null, message: `Some characters are not in the book typeface and print as “?”: ${[...fonts.missing].join(" ")}` });
  const t = theme.tones;
  return {
    widthPt: size.widthPt,
    heightPt: size.heightPt,
    pages: [{ index: 1, folio: null, kind: "cover", itemId: null, archiveId: null, elements: els }],
    warnings,
    bleedPt: 0,
    tones: { ink: t.ink, muted: t.muted, note: t.note, paper: t.paper },
    spineIn: size.spineIn,
  };
}

const TEXT_STYLES: Record<string, { size: number; leading: number; italic: boolean; tone: "ink" | "muted" | "note" }> = {
  heading: { size: 20, leading: 26, italic: false, tone: "ink" },
  body: { size: 11.5, leading: 16.5, italic: false, tone: "ink" },
  caption: { size: 9, leading: 12.5, italic: true, tone: "muted" },
  quote: { size: 14, leading: 20, italic: true, tone: "ink" },
  note: { size: 10.5, leading: 15, italic: false, tone: "note" },
};

/** Plain pasted text → paragraphs; blank lines separate paragraphs, single newlines are kept. */
export function plainToHtml(text: string) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
