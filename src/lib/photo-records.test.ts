import assert from "node:assert/strict";
import { test } from "node:test";
import { photoRecordRef, type PhotoRecordRef } from "./photo-archive";

const linked = new Map<string, PhotoRecordRef>([
  ["p1", { archive_id: "FH0081", title: "Letter home", href: "/letters/FH0081", via: "linked" }],
]);

test("a connected letter is the record to open", () =>
  assert.equal(photoRecordRef({ id: "p1", legacy_archive_id: "FH0029" }, linked)?.archive_id, "FH0081"));

test("an unconnected photo falls back to the FH number it came from", () =>
  assert.equal(photoRecordRef({ id: "p2", legacy_archive_id: "FH0029" }, linked)?.href, "/letters/FH0029"));

test("the legacy fallback is marked as legacy", () =>
  assert.equal(photoRecordRef({ id: "p2", legacy_archive_id: "FH0029" }, linked)?.via, "legacy"));

test("a photo with neither has no record to open", () =>
  assert.equal(photoRecordRef({ id: "p3", legacy_archive_id: null }, linked), null));
