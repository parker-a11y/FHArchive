import assert from "node:assert/strict";
import { test } from "node:test";
import { moveColumn, normalizeColumnOrder } from "./column-order";

const defaults = ["archive_id", "record_type", "subtype", "title", "date"];

test("reset restores the existing column order", () => {
  assert.deepEqual(normalizeColumnOrder(null, defaults), ["archive_id", "record_type", "subtype", "title", "date"]);
});
test("a column can be moved left before another column", () => {
  assert.deepEqual(moveColumn(defaults, "date", "record_type"), ["archive_id", "date", "record_type", "subtype", "title"]);
});
test("a column can be moved right after another column", () => {
  assert.deepEqual(moveColumn(defaults, "record_type", "date", true), ["archive_id", "subtype", "title", "date", "record_type"]);
});
test("saved ordering preserves hidden columns and appends new columns without duplicates", () => {
  assert.deepEqual(normalizeColumnOrder(["title", "date", "title", "retired"], defaults), ["title", "date", "archive_id", "record_type", "subtype"]);
});
test("invalid and self drops leave the order unchanged", () => {
  assert.deepEqual(moveColumn(defaults, "date", "date"), defaults);
  assert.deepEqual(moveColumn(defaults, "unknown", "date"), defaults);
});