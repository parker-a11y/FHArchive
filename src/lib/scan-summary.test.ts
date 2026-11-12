import assert from "node:assert/strict";
import { test } from "node:test";
import { scanSummaryPatch } from "./scan-summary";

test("pending or failed scan reads never reset an existing four-scan record", () => {
  assert.equal(scanSummaryPatch(false, 0, { image_count: 4, scan_status: "scanned" }), null);
});
test("a completed scan read repairs a stale zero count", () => {
  assert.deepEqual(scanSummaryPatch(true, 4, { image_count: 0, scan_status: "not_scanned" }), {
    image_count: 4, scan_status: "scanned",
  });
});
test("only a completed empty scan read can set the count to zero", () => {
  assert.deepEqual(scanSummaryPatch(true, 0, { image_count: 4, scan_status: "scanned" }), {
    image_count: 0, scan_status: "not_scanned",
  });
});
test("matching scan summaries need no write", () => {
  assert.equal(scanSummaryPatch(true, 4, { image_count: 4, scan_status: "scanned" }), null);
});