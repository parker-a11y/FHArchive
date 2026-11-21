import { test } from "node:test";
import assert from "node:assert/strict";
import {
  membershipRows,
  eligibleSuggestions,
  sortCollectionRecords,
  collectionDate,
  type CollectionRecord,
} from "./model";
test("seven original letters can be labeled together without copying archival fields", () => {
  const records = Array.from({ length: 7 }, (_, i) => ({
    kind: "letter" as const,
    id: `uuid-${i}`,
  }));
  const rows = membershipRows(["camp"], records);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[0], {
    collection_id: "camp",
    letter_id: "uuid-0",
    photo_id: null,
    source_id: null,
  });
});
test("overlapping labels and duplicate assignments yield unique memberships", () => {
  assert.equal(
    membershipRows(
      ["a", "b", "a"],
      [
        { kind: "letter", id: "1" },
        { kind: "letter", id: "1" },
      ],
    ).length,
    2,
  );
});
test("photos and sources reference canonical IDs separately", () => {
  assert.deepEqual(
    membershipRows(
      ["a"],
      [
        { kind: "photo", id: "ph" },
        { kind: "source", id: "ds" },
      ],
    ).map((r) => [r.photo_id, r.source_id]),
    [
      ["ph", null],
      [null, "ds"],
    ],
  );
});
test("existing members and remembered dismissals cannot be suggested again", () => {
  const rows = [
    { kind: "letter", ref_id: "1" },
    { kind: "letter", ref_id: "2" },
    { kind: "letter", ref_id: "3" },
    { kind: "letter", ref_id: "3" },
  ];
  assert.deepEqual(
    eligibleSuggestions(rows, [{ kind: "letter", ref_id: "1" }], [{ kind: "letter", ref_id: "2" }]),
    [{ kind: "letter", ref_id: "3" }],
  );
});
test("default collection order is original chronology, undated last", () => {
  const make = (identifier: string, sort_date: string | null): CollectionRecord => ({
    kind: "letter",
    ref_id: identifier,
    identifier,
    sort_date,
    title: null,
    record_type: "letter",
    date_text: null,
    author: null,
    recipient: null,
    origin: null,
    destination: null,
  });
  assert.deepEqual(
    sortCollectionRecords(
      [make("FH2", "1949-07-01"), make("FH3", null), make("FH1", "1934-01-01")],
      "date",
    ).map((r) => r.identifier),
    ["FH1", "FH2", "FH3"],
  );
});
test("original normalized date is shown even when dateline is NONE", () => {
  assert.equal(collectionDate({ sort_date: "1934-01-29", date_text: "NONE" }), "1934-01-29");
});
