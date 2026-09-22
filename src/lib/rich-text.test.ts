import { describe, expect, it } from "vitest";
import { quotedPasteToRichHtml } from "./rich-text";

describe("quotedPasteToRichHtml", () => {
  it("formats curly-quoted paragraphs as blockquotes", () => {
    expect(quotedPasteToRichHtml("Before.\n\n“I had planned to write you.”\n\nAfter.")).toBe(
      "<p>Before.</p><blockquote>“I had planned to write you.”</blockquote><p>After.</p>",
    );
  });

  it("formats straight-quoted multiline paragraphs as blockquotes", () => {
    expect(quotedPasteToRichHtml('"First line\nsecond line."')).toBe(
      '<blockquote>&quot;First line<br />second line.&quot;</blockquote>',
    );
  });

  it("leaves ordinary pasted prose to the editor", () => {
    expect(quotedPasteToRichHtml("An ordinary paragraph.\n\nAnother paragraph.")).toBeNull();
  });

  it("does not format a paragraph with only an inline quotation", () => {
    expect(quotedPasteToRichHtml('Fran wrote, "I will be home soon."')).toBeNull();
  });
});