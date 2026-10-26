import assert from "node:assert/strict";
import { test } from "node:test";
import { groupStorageBoxes } from "./storage-boxes";

test("contents group by current storage box, not original source container", () => {
  const groups = groupStorageBoxes([
    { storage_location: "Box 2", fh_seq: 75, source_container_id: "trunk" },
    { storage_location: "Box 2", fh_seq: 50, source_container_id: "album" },
    { storage_location: "Box 10", fh_seq: 76, source_container_id: "trunk" },
  ]);
  assert.deepEqual(groups.map((g) => [g.name, g.records.map((r) => r.fh_seq)]), [
    ["Box 2", [50, 75]], ["Box 10", [76]],
  ]);
});

test("records without a box remain visible in a separate final group", () => {
  const groups = groupStorageBoxes([
    { storage_location: null, fh_seq: 3 },
    { storage_location: " Box 1 ", fh_seq: 2 },
    { storage_location: "   ", fh_seq: 1 },
  ]);
  assert.deepEqual(groups.map((g) => [g.name, g.records.map((r) => r.fh_seq)]), [
    ["Box 1", [2]], ["", [1, 3]],
  ]);
  assert.equal(groups.reduce((sum, g) => sum + g.records.length, 0), 3);
});