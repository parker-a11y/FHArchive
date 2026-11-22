import assert from "node:assert/strict";
import { test } from "node:test";
import { flatScanName } from "./scan-zip-names";

test("scan ZIP entries are flat file names carrying the record number", () => {
  const taken = new Set<string>();
  const name = flatScanName("FH0817", "Page 1 Front.tif", taken);
  assert.equal(name, "FH0817 - Page 1 Front.tif");
  assert.ok(!name.includes("/"), "must not create a folder");
});

test("a path in the original file name never becomes a folder", () => {
  const name = flatScanName("FH0817", "uploads/2026/IMG_0042.TIFF", new Set());
  assert.equal(name, "FH0817 - IMG_0042.TIFF");
});

test("duplicate names gain a counter before the extension", () => {
  const taken = new Set<string>();
  const a = flatScanName("FH0817", "scan.tif", taken);
  taken.add(a);
  const b = flatScanName("FH0817", "scan.tif", taken);
  taken.add(b);
  const c = flatScanName("FH0817", "scan.tif", taken);
  assert.deepEqual([a, b, c], ["FH0817 - scan.tif", "FH0817 - scan (2).tif", "FH0817 - scan (3).tif"]);
});

test("the same file name from two records stays separate", () => {
  const taken = new Set<string>();
  const a = flatScanName("FH0817", "front.jpg", taken);
  taken.add(a);
  const b = flatScanName("FH0818", "front.jpg", taken);
  assert.deepEqual([a, b], ["FH0817 - front.jpg", "FH0818 - front.jpg"]);
});

test("a name with no extension still gets a unique counter", () => {
  const taken = new Set(["FH0817 - master"]);
  assert.equal(flatScanName("FH0817", "master", taken), "FH0817 - master (2)");
});
