import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyPhotoNotes } from "./photo-notes";

test("keeps every filled detail and the old FH number", () => {
  const n = legacyPhotoNotes({
    archive_id: "FH0080",
    date_as_written: "June 1943",
    photo_back_inscription: "Skip at the beach",
    primary_person: "Skip",
    storage_location: "Box 1",
  });
  assert.equal(n, "Date: June 1943\nWriting on back: Skip at the beach\nPeople: Skip\nBox: Box 1\nFormerly FH0080");
});

test("skips empty fields", () => {
  assert.equal(legacyPhotoNotes({ archive_id: "FH0020", notes: "  ", origin: "" }), "Formerly FH0020");
});
