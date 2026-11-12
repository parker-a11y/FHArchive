import assert from "node:assert/strict";
import { test } from "node:test";
import { unprintedRun } from "./multi-label";

const recs = [10, 9, 8, 7, 6].map((n) => ({ id: `r${n}`, fh_seq: n }));

test("stops at the last previously printed label", () => {
  assert.deepEqual(unprintedRun(recs, new Set(["r7"])).map((r) => r.fh_seq), [10, 9, 8]);
});
test("stops immediately when the first record is printed", () => {
  assert.deepEqual(unprintedRun(recs, new Set(["r10"])), []);
});
test("caps the run length", () => {
  assert.deepEqual(unprintedRun(recs, new Set(), 2).map((r) => r.fh_seq), [10, 9]);
});
