import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseArchiveIds } from "./ids";
import { parseTranscription, blocksPlainText } from "./text";
import { createBookFonts, BOOK_FONT_FILES } from "./fonts";
import { buildPlan } from "./layout";
import type { BookRecordSource, FontKey } from "./types";

const fonts = () =>
  createBookFonts(
    Object.fromEntries(Object.entries(BOOK_FONT_FILES).map(([k, f]) => [k, new Uint8Array(readFileSync(`public/fonts/book/${f}`))])) as Record<FontKey, Uint8Array>,
  );

const img = (label: string) => ({ fileId: label, label, path: `x/${label}.jpg`, source: "print" as const, derivativeId: null, width: 4000, height: 5600 });
const record = (over: Partial<BookRecordSource> = {}): BookRecordSource => ({
  itemId: "i1", letterId: "l1", archiveId: "FH0001", dateLabel: "Dec. 27, 1944", sortDate: null, author: "Fran", recipient: "Jaq",
  location: null, title: null, scans: [img("Page 1 Front"), img("Page 1 Back")], envelopes: [img("Envelope Front")],
  transcription: "<p>Darling -</p><p>" + "I love you so. ".repeat(400) + "</p><p>Fran</p>", transcriptionVerified: true,
  fingerprint: "a", storedFingerprint: "a", updatedAt: null, hasEnvelopeFlag: true, ...over,
});
const meta = { id: "b", title: "Test", subtitle: null, trimWidthIn: 8.5, trimHeightIn: 11, settings: { scansPerPage: 1 as const, titlePage: false } };

describe("Book Builder", () => {
  it("parses archive ID lists and ranges", () => {
    expect(parseArchiveIds("FH0012, fh40-FH42 77")).toEqual(["FH0012", "FH0040", "FH0041", "FH0042", "FH0077"]);
  });

  it("keeps every character of a transcription, including italics and uncertainty marks", () => {
    const blocks = parseTranscription("<p>Dear <em>Jaq</em> [illegible] &amp; café?<br />Fran</p>");
    expect(blocksPlainText(blocks)).toBe("Dear Jaq [illegible] & café?\nFran");
    expect(blocks[0].inlines.find((i) => i.text === "Jaq")?.italic).toBe(true);
  });

  it("orders each record as letter scans, then envelope, then transcription", () => {
    const plan = buildPlan(meta, [record()], fonts());
    const kinds = plan.pages.map((p) => p.kind);
    expect(kinds.slice(0, 3)).toEqual(["scan", "scan", "envelope"]);
    expect(kinds.slice(3).every((k) => k === "text")).toBe(true);
    expect(kinds.length).toBeGreaterThan(4); // long transcription flows over several pages
  });

  it("never drops or invents an envelope", () => {
    const plan = buildPlan(meta, [record({ envelopes: [] })], fonts());
    expect(plan.pages.some((p) => p.kind === "envelope")).toBe(false);
  });

  it("prints all transcription words with no text below the bottom margin", () => {
    const rec = record();
    const plan = buildPlan(meta, [rec], fonts());
    const words = plan.pages.filter((p) => p.kind === "text").flatMap((p) => p.elements).filter((e) => e.t === "text" && e.size === 11.5);
    expect(words.length).toBe(blocksPlainText(parseTranscription(rec.transcription)).split(/\s+/).filter(Boolean).length);
    expect(words.every((w) => w.t === "text" && w.y <= 11 * 72 - 74)).toBe(true);
  });

  it("flags scans printing under 200 DPI", () => {
    const low = { ...img("Page 1 Front"), width: 900, height: 1260 };
    const plan = buildPlan(meta, [record({ scans: [low] })], fonts());
    expect(plan.warnings.some((w) => w.level === "warning" && /DPI/.test(w.message))).toBe(true);
  });
});
