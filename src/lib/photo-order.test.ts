import assert from "node:assert/strict";
import { test } from "node:test";
import { reorderScans } from "./scan-order";

test("gallery drag moves a photo before the indicated photo", () => {
  const photos = ["front", "middle", "last"].map((id) => ({ id }));
  assert.deepEqual(reorderScans(photos, "last", { id: "front", side: "before" }).map((p) => p.id), ["last", "front", "middle"]);
});

test("gallery drag moves a photo after the indicated photo", () => {
  const photos = ["front", "middle", "last"].map((id) => ({ id }));
  assert.deepEqual(reorderScans(photos, "front", { id: "last", side: "after" }).map((p) => p.id), ["middle", "last", "front"]);
});

test("filtered gallery reordering retains hidden photos and their relative order", () => {
  const photos = ["visible-a", "hidden-a", "visible-b", "hidden-b"].map((id) => ({ id }));
  const moved = reorderScans(photos, "visible-b", { id: "visible-a", side: "before" });
  assert.deepEqual(moved.map((p) => p.id), ["visible-b", "visible-a", "hidden-a", "hidden-b"]);
  assert.deepEqual(photos.map((p) => p.id), ["visible-a", "hidden-a", "visible-b", "hidden-b"]);
});