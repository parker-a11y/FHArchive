import assert from "node:assert/strict";
import { test } from "node:test";
import { WRITER_MAX_RECORDS, fitWriterIds } from "./writer-limits";

test("a selection larger than the limit attaches the first records and lists the rest", () => {
  const selection = Array.from({ length: 30 }, (_, i) => `FH${String(i + 1).padStart(4, "0")}`);
  const { ids, dropped } = fitWriterIds(selection);
  assert.equal(ids.length, WRITER_MAX_RECORDS);
  assert.deepEqual(ids.slice(0, 2), ["FH0001", "FH0002"]);
  assert.deepEqual(dropped, ["FH0026", "FH0027", "FH0028", "FH0029", "FH0030"]);
});

test("a selection within the limit attaches everything and drops nothing", () => {
  const { ids, dropped } = fitWriterIds(["FH0015", "FH0011"]);
  assert.deepEqual(ids, ["FH0015", "FH0011"]);
  assert.deepEqual(dropped, []);
});

test("the same record listed twice is attached once", () => {
  const { ids, dropped } = fitWriterIds(["FH0015", "FH0015", "FH0011"]);
  assert.deepEqual(ids, ["FH0015", "FH0011"]);
  assert.deepEqual(dropped, []);
});
