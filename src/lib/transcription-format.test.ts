import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  combineTranscriptionPages,
  flowingCombinedTranscription,
  removeRepeatedNavyLetterhead,
} from "./transcription-format";
import { richTextToPlain } from "./rich-text";

describe("flowingCombinedTranscription", () => {
  test("removes labeled and unlabeled system page headings", () => {
    assert.equal(
      flowingCombinedTranscription(
        "— Page 1 (Page 1 Front) —\n\nDear Jaq,\n\nThe ship sailed\n\n— Page 2 —\n\nbefore dawn.",
      ),
      "Dear Jaq,\n\nThe ship sailed before dawn.",
    );
  });

  test("preserves real paragraph breaks inside pages", () => {
    assert.equal(combineTranscriptionPages(["Dear Jaq,\n\nFirst paragraph.", "Second page."]),
      "Dear Jaq,\n\nFirst paragraph. Second page.",
    );
  });

  test("does not remove ordinary references to pages", () => {
    const text = "Please turn to Page 2 when you have time.";
    assert.equal(flowingCombinedTranscription(text), text);
  });

  test("supports the older triple-hyphen marker", () => {
    assert.equal(
      flowingCombinedTranscription("First half\n\n--- Page 2 (Reverse) ---\n\nsecond half"),
      "First half second half",
    );
  });

  test("preserves formatted pages in a combined transcription", () => {
    assert.equal(
      combineTranscriptionPages(["<p>Dear <u>Jaq</u>,</p>", "Second page."]),
      "<p>Dear <u>Jaq</u>,</p><p>Second page.</p>",
    );
  });

  test("keeps formatting out of text-only consumers", () => {
    assert.equal(
      richTextToPlain('<p style="text-align:center">Dear <u>Jaq</u>,</p><p><s>Cary</s> Gary</p>'),
      "Dear Jaq,\n\nCary Gary",
    );
  });
});

describe("removeRepeatedNavyLetterhead", () => {
  test("keeps the first page and removes the repeated heading from a later page", () => {
    const first = "UNITED STATES NAVY\n\n14 Nov.\n\nDarling,";
    assert.equal(removeRepeatedNavyLetterhead(first, first), "14 Nov.\n\nDarling,");
    assert.equal(
      removeRepeatedNavyLetterhead(first, "UNITED STATES NAVY\n\nover the harbor we sailed."),
      "over the harbor we sailed.",
    );
  });

  test("supports formatted pages and Navy wording variants", () => {
    assert.equal(
      removeRepeatedNavyLetterhead(
        '<p style="text-align:center">U.S. NAVY</p><p>Dearest,</p>',
        "<p>UNITED STATES NAVY</p><p>The second page.</p>",
      ),
      "<p>The second page.</p>",
    );
  });

  test("does not remove body references or a heading absent from page one", () => {
    assert.equal(
      removeRepeatedNavyLetterhead("Dearest,", "UNITED STATES NAVY\n\nThe song begins."),
      "UNITED STATES NAVY\n\nThe song begins.",
    );
    assert.equal(
      removeRepeatedNavyLetterhead(
        "UNITED STATES NAVY\n\nDearest,",
        "We all think the Navy is nuts at this point.",
      ),
      "We all think the Navy is nuts at this point.",
    );
  });
});