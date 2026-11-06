import { describe, expect, it } from "vitest";
import { applySelectionClick, categoryKey, formatPhId, matchesCategories, nextBoxCode, normalizeBoxCode, parsePhotoYears } from "./photo-archive";

describe("PH identifiers", () => {
  it("pads to five digits", () => expect(formatPhId(1)).toBe("PH00001"));
  it("expands beyond five digits", () => expect(formatPhId(123456)).toBe("PH123456"));
});

describe("category names", () => {
  it("treats capitalization and spacing as the same name", () =>
    expect(categoryKey("  Harley   family ")).toBe(categoryKey("Harley Family")));
});

describe("photo boxes", () => {
  it("normalizes PHOTO codes", () => expect(normalizeBoxCode("photo 3")).toBe("PHOTO-003"));
  it("suggests the next code", () => expect(nextBoxCode(["PHOTO-001", "PHOTO-002"])).toBe("PHOTO-003"));
});

describe("selection", () => {
  const ids = ["a", "b", "c", "d", "e"];
  it("shift-click selects a continuous range", () =>
    expect([...applySelectionClick(ids, new Set(["b"]), "b", "e", true)].sort()).toEqual(["b", "c", "d", "e"]));
  it("plain click toggles one", () => expect(applySelectionClick(ids, new Set(["b"]), "b", "b", false).size).toBe(0));
});

describe("approximate dates", () => {
  it("reads a decade", () => expect(parsePhotoYears("1940s")).toEqual({ start: 1940, end: 1949 }));
  it("reads circa", () => expect(parsePhotoYears("Circa 1937")).toEqual({ start: 1937, end: 1937 }));
  it("reads a range", () => expect(parsePhotoYears("1935–1940")).toEqual({ start: 1935, end: 1940 }));
  it("leaves unclear dates alone", () => expect(parsePhotoYears("summer, unknown")).toBeNull());
});

describe("category filters", () => {
  it("any matches one", () => expect(matchesCategories(["x"], ["x", "y"], "any")).toBe(true));
  it("all requires every one", () => expect(matchesCategories(["x"], ["x", "y"], "all")).toBe(false));
});
