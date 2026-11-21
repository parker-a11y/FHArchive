import assert from "node:assert/strict";
import { test } from "node:test";
import { COLUMNS, DEFAULT_COLUMN_ORDER } from "./record-columns";
import { normalizeColumnOrder } from "./column-order";

test("Collections is its own column, without replacing any archive columns", () => {
  assert.equal(COLUMNS.find(c => c.key === "collections")?.label, "Collections");
  assert.deepEqual(DEFAULT_COLUMN_ORDER.filter(key => key !== "collections"), [
    "archive_id", "record_type", "subtype", "title", "date", "date_precision", "destination",
    "primary_person", "author", "recipient", "origin", "storage", "sheets", "image_count", "has_envelope",
    "digitization_status", "scan_status", "transcription_status", "tones", "keywords", "notes",
  ]);
});
test("an existing saved arrangement gains Collections without rearranging existing columns", () => {
  const saved = DEFAULT_COLUMN_ORDER.filter(key => key !== "collections").reverse();
  assert.deepEqual(normalizeColumnOrder(saved, DEFAULT_COLUMN_ORDER), [...saved, "collections"]);
});