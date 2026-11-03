import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
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
  location: null, origin: "Camp DeWitt, Wolfeboro, NH", destination: "Worcester, Mass.", title: null, scans: [img("Page 1 Front"), img("Page 1 Back")], envelopes: [img("Envelope Front")],
  transcription: "<p>Darling -</p><p>" + "I love you so. ".repeat(400) + "</p><p>Fran</p>", transcriptionVerified: true,
  fingerprint: "a", storedFingerprint: "a", updatedAt: null, hasEnvelopeFlag: true, ...over,
});
const meta = { id: "b", title: "Test", subtitle: null, trimWidthIn: 8.5, trimHeightIn: 11, settings: { scansPerPage: 1 as const, titlePage: false, envelopeFirst: false } };
const ef = { ...meta, settings: { ...meta.settings, envelopeFirst: true, titlePage: true } };

test("parses archive ID lists and ranges", () => {
    assert.deepEqual(parseArchiveIds("FH0012, fh40-FH42 77"), ["FH0012", "FH0040", "FH0041", "FH0042", "FH0077"]);
  });

test("keeps every character of a transcription, including italics and uncertainty marks", () => {
    const blocks = parseTranscription("<p>Dear <em>Jaq</em> [illegible] &amp; café?<br />Fran</p>");
    assert.equal(blocksPlainText(blocks), "Dear Jaq [illegible] & café?\nFran");
    assert.equal(blocks[0].inlines.find((i) => i.text === "Jaq")?.italic, true);
  });

test("orders each record as letter scans, then envelope, then transcription", () => {
    const plan = buildPlan(meta, [record()], fonts());
    const kinds = plan.pages.map((p) => p.kind);
    assert.deepEqual(kinds.slice(0, 3), ["scan", "scan", "envelope"]);
    assert.ok(kinds.slice(3).every((k) => k === "text"));
    assert.ok(kinds.length > 4); // long transcription flows over several pages
  });

test("never drops or invents an envelope", () => {
    const plan = buildPlan(meta, [record({ envelopes: [] })], fonts());
    assert.equal(plan.pages.some((p) => p.kind === "envelope"), false);
  });

test("prints all transcription words with no text below the bottom margin", () => {
    const rec = record();
    const plan = buildPlan(meta, [rec], fonts());
    const words = plan.pages.filter((p) => p.kind === "text").flatMap((p) => p.elements).filter((e) => e.t === "text" && e.size === 11.5);
    assert.equal(words.length, blocksPlainText(parseTranscription(rec.transcription)).split(/\s+/).filter(Boolean).length);
    assert.ok(words.every((w) => w.t === "text" && w.y <= 11 * 72 - 74));
  });

test("flags scans printing under 200 DPI", () => {
    const low = { ...img("Page 1 Front"), width: 900, height: 1260 };
    const plan = buildPlan(meta, [record({ scans: [low] })], fonts());
    assert.ok(plan.warnings.some((w) => w.level === "warning" && /DPI/.test(w.message)));
  });


const texts = (p: { elements: Array<{ t: string }> }) => p.elements.filter((e): e is { t: "text"; text: string } & typeof e => e.t === "text").map((e) => (e as any).text).join(" ");

test("Envelope First: envelope intro on the right, blank reverse, scans open on the right", () => {
  const plan = buildPlan(ef, [record(), record({ itemId: "i2", archiveId: "FH0002" })], fonts());
  const kinds = plan.pages.map((p) => p.kind);
  assert.deepEqual(kinds.slice(0, 5), ["title", "blank", "envelope", "blank", "scan"]);
  for (const p of plan.pages) {
    if (p.kind === "envelope") assert.equal(p.index % 2, 1, "envelope pages are right-hand");
    if (p.kind === "envelope" || p.kind === "blank") assert.equal(p.folio, null);
  }
  const firstScans = plan.pages.filter((p, i) => p.kind === "scan" && plan.pages[i - 1].kind !== "scan");
  assert.ok(firstScans.every((p) => p.index % 2 === 1), "first handwritten page is right-hand");
  assert.ok(plan.pages.filter((p) => p.kind === "blank").every((p) => p.elements.length === 0));
  assert.equal(plan.pages.filter((p) => p.kind === "envelope").length, 2);
});

test("Envelope First intro shows only catalogued facts", () => {
  const plan = buildPlan(ef, [record()], fonts());
  const intro = texts(plan.pages.find((p) => p.kind === "envelope")!);
  for (const part of ["Letter", "from", "Fran", "To", "Jaq", "Camp", "Worcester", "FH0001"]) assert.ok(intro.includes(part), part);
  const bare = texts(buildPlan(ef, [record({ destination: null, recipient: null })], fonts()).pages.find((p) => p.kind === "envelope")!);
  assert.ok(!bare.includes("Worcester") && !bare.includes("Jaq"));
});

test("Envelope First without an envelope gives a text-only intro and no images", () => {
  const plan = buildPlan(ef, [record({ envelopes: [] })], fonts());
  const intro = plan.pages.find((p) => p.kind === "envelope")!;
  assert.equal(intro.elements.some((e) => e.t === "image"), false);
  assert.ok(texts(intro).includes("Fran"));
});

test("Envelope First: each scan gets its own page, every scan appears once", () => {
  const plan = buildPlan({ ...ef, settings: { ...ef.settings, scansPerPage: 2 } }, [record()], fonts());
  const scanPages = plan.pages.filter((p) => p.kind === "scan");
  assert.equal(scanPages.length, 2);
  assert.ok(scanPages.every((p) => p.elements.filter((e) => e.t === "image").length === 1));
});
