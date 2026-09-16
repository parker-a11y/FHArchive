import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  combineTranscriptionPages,
  flowingCombinedTranscription,
} from "./transcription-format";

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
});