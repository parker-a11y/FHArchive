import { describe, expect, test } from "bun:test";
import {
  combineTranscriptionPages,
  flowingCombinedTranscription,
} from "./transcription-format";

describe("flowingCombinedTranscription", () => {
  test("removes labeled and unlabeled system page headings", () => {
    expect(
      flowingCombinedTranscription(
        "— Page 1 (Page 1 Front) —\n\nDear Jaq,\n\nThe ship sailed\n\n— Page 2 —\n\nbefore dawn.",
      ),
    ).toBe("Dear Jaq,\n\nThe ship sailed before dawn.");
  });

  test("preserves real paragraph breaks inside pages", () => {
    expect(combineTranscriptionPages(["Dear Jaq,\n\nFirst paragraph.", "Second page."])).toBe(
      "Dear Jaq,\n\nFirst paragraph. Second page.",
    );
  });

  test("does not remove ordinary references to pages", () => {
    const text = "Please turn to Page 2 when you have time.";
    expect(flowingCombinedTranscription(text)).toBe(text);
  });

  test("supports the older triple-hyphen marker", () => {
    expect(flowingCombinedTranscription("First half\n\n--- Page 2 (Reverse) ---\n\nsecond half"))
      .toBe("First half second half");
  });
});