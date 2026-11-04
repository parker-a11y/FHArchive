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

// ---- Phase 2: custom pages ----
import { makeTemplate, TEMPLATES, coverRect, containRect, snapBox, SAFE } from "./templates";
import type { BookPageSource } from "./types";

const page = (doc = makeTemplate("photo-fit"), images: BookPageSource["images"] = {}): BookPageSource => ({ type: "page", itemId: "p1", doc, images, fingerprint: "f", storedFingerprint: "f" });

test("offers 17 templates, each producing a valid page", () => {
  assert.equal(TEMPLATES.length, 17);
  for (const t of TEMPLATES) {
    const plan = buildPlan(meta, [page(makeTemplate(t.id))], fonts());
    assert.ok(plan.pages.length >= 1, t.id);
    assert.ok(plan.pages.every((p) => p.kind === "custom"), t.id);
  }
});

test("custom pages share one sequence with letters", () => {
  const plan = buildPlan(meta, [page(makeTemplate("divider")), record(), page(makeTemplate("text"))], fonts());
  assert.equal(plan.pages[0].kind, "custom");
  assert.equal(plan.pages[plan.pages.length - 1].kind, "custom");
  assert.equal(plan.pages[0].folio, null); // dividers print no page number
});

test("fit never crops; fill covers the box and is clipped to it", () => {
  const box = { x: 0, y: 0, w: 400, h: 400 };
  const fit = containRect(2000, 1000, box);
  assert.deepEqual([fit.w, fit.h], [400, 200]);
  const fill = coverRect(2000, 1000, box);
  assert.deepEqual([fill.w, fill.h], [800, 400]);
  const doc = makeTemplate("photo-bleed");
  const im = { fileId: "u", label: "u", path: "pages/x.jpg", source: "print" as const, derivativeId: null, width: 6000, height: 4000, bucket: "book-images" as const };
  const plan = buildPlan(meta, [page(doc, { [doc.boxes[0].id]: im })], fonts());
  const el = plan.pages[0].elements.find((e) => e.t === "image")!;
  assert.ok(el.t === "image" && el.clip && el.clip.w === 612 && el.clip.h === 792 && el.h === 792 && el.w > 612);
});

test("snaps a moved box to the margin", () => {
  const { box } = snapBox({ x: SAFE.x + 4, y: 200, w: 100, h: 100 }, [], "move");
  assert.equal(box.x, SAFE.x);
});

test("a long research essay flows across several numbered pages", () => {
  const doc = makeTemplate("essay");
  doc.flow = { heading: "The Navy Years", text: Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ` + "Research text about the war years. ".repeat(20)).join("\n\n") };
  const plan = buildPlan(meta, [page(doc)], fonts());
  assert.ok(plan.pages.length >= 6);
  assert.ok(plan.pages.every((p) => p.folio !== null));
});

// ---- Phase 3: chapters, contents, themes, printers, preflight, cover ----
import { buildCoverPlan } from "./layout";
import { runPreflight } from "./preflight";
import { PRINTERS, coverSize, gutterIn } from "./printers";
import type { BookChapterSource } from "./types";

const chapter = (itemId: string, title: string): BookChapterSource => ({ type: "chapter", itemId, doc: { title, subtitle: "", epigraph: "A line", epigraphSource: "Fran" } });
const p3 = (over: Record<string, unknown> = {}) => ({ ...ef, settings: { ...ef.settings, toc: { enabled: true, records: true }, ...over } });

test("chapters open on right-hand pages and run in the left-hand heads", () => {
  const plan = buildPlan(p3(), [chapter("c1", "Boot Camp"), record(), chapter("c2", "At Sea"), record({ itemId: "i2", archiveId: "FH0002" })], fonts());
  const chs = plan.pages.filter((p) => p.kind === "chapter");
  assert.equal(chs.length, 2);
  assert.ok(chs.every((p) => p.index % 2 === 1 && p.folio === null));
  const leftAfter = plan.pages.find((p) => p.index > chs[1].index && p.index % 2 === 0 && p.folio !== null)!;
  assert.ok(texts(leftAfter).includes("At Sea"));
});

test("table of contents page numbers match the real page plan", () => {
  const entries = [chapter("c1", "Boot Camp"), record(), chapter("c2", "At Sea"), record({ itemId: "i2", archiveId: "FH0002" })];
  const plan = buildPlan(p3(), entries, fonts());
  const toc = plan.pages.filter((p) => p.kind === "toc");
  assert.ok(toc.length >= 1);
  const tocText = toc.map(texts).join(" ");
  for (const id of ["c1", "c2", "i1", "i2"]) {
    const start = plan.pages.find((p) => p.itemId === id)!.index;
    assert.ok(new RegExp(`\\b${start}\\b`).test(tocText), `${id} → p. ${start}`);
  }
  // A long contents list spills onto more pages without shifting the numbers it prints.
  const many = Array.from({ length: 80 }, (_, i) => record({ itemId: `r${i}`, archiveId: `FH${String(i).padStart(4, "0")}`, scans: [img("P1")], envelopes: [], transcription: "<p>Short.</p>" }));
  const big = buildPlan(p3(), many, fonts());
  assert.ok(big.pages.filter((p) => p.kind === "toc").length >= 2);
  const lastStart = big.pages.find((p) => p.itemId === "r79")!.index;
  assert.ok(big.pages.filter((p) => p.kind === "toc").map(texts).join(" ").includes(String(lastStart)));
});

test("facing layout puts each scan on a left page with its own transcription opposite", () => {
  const rec = record({ pageTexts: { "Page 1 Front": "<p>First page words.</p>", "Page 1 Back": "<p>Second page words.</p>" } });
  const plan = buildPlan(p3({ facing: true, toc: { enabled: false, records: false } }), [rec], fonts());
  const scans = plan.pages.filter((p) => p.kind === "scan");
  assert.equal(scans.length, 2);
  for (const sp of scans) {
    assert.equal(sp.index % 2, 0, "scan on the left");
    assert.equal(plan.pages[sp.index].kind, "text", "transcription opposite");
  }
  assert.ok(texts(plan.pages[scans[0].index]).includes("First"));
  assert.ok(texts(plan.pages[scans[1].index]).includes("Second"));
});

test("printer rules: Lulu gutter tiers, even page count, spine width", () => {
  assert.equal(gutterIn(PRINTERS.lulu, 50), 0);
  assert.equal(gutterIn(PRINTERS.lulu, 200), 0.5);
  assert.ok(Math.abs(PRINTERS.lulu.spineIn(444) - 1.06) < 1e-9);
  const plan = buildPlan({ ...meta, settings: { ...meta.settings, printer: "lulu" } }, [record({ envelopes: [], scans: [img("P1")], transcription: "<p>Hi</p>" })], fonts());
  assert.equal(plan.pages.length % 2, 0);
  assert.equal(plan.bleedPt, 9);
  const c = coverSize(PRINTERS.lulu, 6, 9, 444);
  assert.ok(Math.abs(c.widthPt / 72 - (12 + 1.06 + 0.25)) < 1e-6);
});

test("preflight catches page count, low resolution and missing bleed; generic is never print-ready", () => {
  const luluMeta = { ...meta, settings: { ...meta.settings, printer: "lulu" } };
  const low = { ...img("Page 1 Front"), width: 900, height: 1260 };
  const plan = buildPlan(luluMeta, [record({ scans: [low] })], fonts());
  const r = runPreflight(plan, [], "lulu", fonts());
  assert.equal(r.printReady, false);
  assert.ok(r.items.some((i) => i.level === "error" && /minimum of 32/.test(i.message)));
  assert.ok(r.items.some((i) => i.level === "error" && /DPI/.test(i.message)));
  const doc = makeTemplate("photo-fit");
  doc.boxes = [{ ...(doc.boxes[0] as any), x: 0, y: 0, w: 612, h: 300, mode: "fill" }];
  const im = { fileId: "u", label: "u", path: "pages/x.jpg", source: "print" as const, derivativeId: null, width: 6000, height: 4000, bucket: "book-images" as const };
  const edge = buildPlan(luluMeta, [page(doc, { [doc.boxes[0].id]: im })], fonts());
  assert.ok(runPreflight(edge, [], "lulu", fonts()).items.some((i) => /bleed/.test(i.message) && i.level === "error"));
  assert.equal(runPreflight(buildPlan(meta, [record()], fonts()), [], "generic", fonts()).printReady, false);
  const stale = runPreflight(plan, [{ level: "error", archiveId: "FH0001", itemId: "i1", message: "changed" }], "lulu", fonts());
  assert.ok(stale.items.some((i) => i.message === "changed"));
});

test("a clean Lulu book with enough pages passes preflight", () => {
  const many = Array.from({ length: 12 }, (_, i) => record({ itemId: `r${i}`, archiveId: `FH${i}` }));
  const m = { ...ef, settings: { ...ef.settings, printer: "lulu" } };
  const plan = buildPlan(m, many, fonts());
  const r = runPreflight(plan, [], "lulu", fonts());
  assert.deepEqual(r.items.filter((i) => i.level === "error"), []);
  assert.equal(r.printReady, true);
});

test("cover spread: back, spine, front sized from the page count", () => {
  const m = { ...meta, settings: { ...meta.settings, printer: "lulu" } };
  const cp = buildCoverPlan(m, { template: "cloth", title: "Letters", subtitle: "", author: "Fran", backText: "Back", spineText: true, image: null }, null, 300, fonts());
  assert.ok(Math.abs(cp.widthPt / 72 - (17 + 300 / 444 + 0.06 + 0.25)) < 1e-6);
  assert.ok(cp.pages[0].elements.some((e) => e.t === "text" && e.rotate));
  const thin = buildCoverPlan(m, { template: "classic", title: "Letters", subtitle: "", author: "", backText: "", spineText: true, image: null }, null, 40, fonts());
  assert.ok(!thin.pages[0].elements.some((e) => e.t === "text" && e.rotate));
});

test("classic theme with no printer keeps the original layout", () => {
  const a = buildPlan(ef, [record()], fonts());
  const b = buildPlan({ ...ef, settings: { ...ef.settings, theme: "classic", printer: "generic" } }, [record()], fonts());
  assert.equal(a.pages.length, b.pages.length);
  assert.equal(a.margins?.inside, 72);
  const w = buildPlan({ ...ef, settings: { ...ef.settings, theme: "modern" } }, [record()], fonts());
  assert.ok(w.pages.length !== a.pages.length || w.margins?.inside !== 72);
});
