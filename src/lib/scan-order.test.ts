import assert from "node:assert/strict";
import { test } from "node:test";
import { reorderScans } from "./scan-order";

const files = ["a", "b", "c", "d"].map((id) => ({ id }));
const ids = (items: typeof files) => items.map((item) => item.id);

test("moving forward lands before the indicated scan, not after it", () => {
  assert.deepEqual(ids(reorderScans(files, "a", { id: "c", side: "before" })), ["b", "a", "c", "d"]);
});
test("moving backward lands after the indicated scan", () => {
  assert.deepEqual(ids(reorderScans(files, "d", { id: "b", side: "after" })), ["a", "b", "d", "c"]);
});
test("supports first and last insertion boundaries", () => {
  assert.deepEqual(ids(reorderScans(files, "d", { id: "a", side: "before" })), ["d", "a", "b", "c"]);
  assert.deepEqual(ids(reorderScans(files, "a", { id: "d", side: "after" })), ["b", "c", "d", "a"]);
});
test("self drops and missing targets leave the order unchanged", () => {
  assert.deepEqual(reorderScans(files, "b", { id: "b", side: "after" }), files);
  assert.deepEqual(reorderScans(files, "b", { id: "missing", side: "before" }), files);
});