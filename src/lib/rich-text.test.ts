import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { quotedPasteToRichHtml } from "./rich-text";

describe("quotedPasteToRichHtml", () => {
  test("formats curly-quoted paragraphs as blockquotes", () => {
    assert.equal(quotedPasteToRichHtml("Before.\n\n“I had planned to write you.”\n\nAfter."),
      "<p>Before.</p><blockquote>“I had planned to write you.”</blockquote><p>After.</p>",
    );
  });

  test("formats straight-quoted multiline paragraphs as blockquotes", () => {
    assert.equal(quotedPasteToRichHtml('"First line\nsecond line."'),
      '<blockquote>&quot;First line<br />second line.&quot;</blockquote>',
    );
  });

  test("leaves ordinary pasted prose to the editor", () => {
    assert.equal(quotedPasteToRichHtml("An ordinary paragraph.\n\nAnother paragraph."), null);
  });

  test("does not format a paragraph with only an inline quotation", () => {
    assert.equal(quotedPasteToRichHtml('Fran wrote, "I will be home soon."'), null);
  });
});