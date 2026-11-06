import assert from "node:assert/strict";
import { test } from "node:test";
import { applySelectionClick, categoryKey, formatPhId, matchesCategories, nextBoxCode, normalizeBoxCode, parsePhotoYears } from "./photo-archive";

test("PH numbers pad to five digits", () => assert.equal(formatPhId(1), "PH00001"));
test("PH numbers expand beyond five digits", () => assert.equal(formatPhId(123456), "PH123456"));
test("category names ignore capitalization and spacing", () => assert.equal(categoryKey("  Harley   family "), categoryKey("Harley Family")));
test("photo box codes normalize", () => assert.equal(normalizeBoxCode("photo 3"), "PHOTO-003"));
test("next photo box code", () => assert.equal(nextBoxCode(["PHOTO-001", "PHOTO-002"]), "PHOTO-003"));
test("shift-click selects a continuous range", () =>
  assert.deepEqual([...applySelectionClick(["a", "b", "c", "d", "e"], new Set(["b"]), "b", "e", true)].sort(), ["b", "c", "d", "e"]));
test("plain click toggles one", () => assert.equal(applySelectionClick(["a", "b"], new Set(["b"]), "b", "b", false).size, 0));
test("decade date", () => assert.deepEqual(parsePhotoYears("1940s"), { start: 1940, end: 1949 }));
test("circa date", () => assert.deepEqual(parsePhotoYears("Circa 1937"), { start: 1937, end: 1937 }));
test("date range", () => assert.deepEqual(parsePhotoYears("1935–1940"), { start: 1935, end: 1940 }));
test("unclear date stays unparsed", () => assert.equal(parsePhotoYears("summer, unknown"), null));
test("match any category", () => assert.equal(matchesCategories(["x"], ["x", "y"], "any"), true));
test("match all categories", () => assert.equal(matchesCategories(["x"], ["x", "y"], "all"), false));

import { nextSleeveCode as _nextSleeve } from "./photo-archive";
describe("sleeve numbering", () => {
  it("starts at SLEEVE-001", () => expect(_nextSleeve([])).toBe("SLEEVE-001"));
  it("follows the highest existing sleeve", () => expect(_nextSleeve(["SLEEVE-002", "SLEEVE-010", "PHOTO-050"])).toBe("SLEEVE-011"));
});
