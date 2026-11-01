import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sharedContextRecords, type ContextMembership } from "./letter-context";

const record = (id: string) => ({ id, archive_id: `FH${id}`, normalized_date: "1944-01-01" });
const rows: ContextMembership[] = [
  { person_id: "fran", letter_id: "1", letters: record("1") },
  { person_id: "fran", letter_id: "1", letters: record("1") },
  { person_id: "skip", letter_id: "1", letters: record("1") },
  { person_id: "fran", letter_id: "2", letters: record("2") },
  { person_id: "skip", letter_id: "3", letters: null },
];
describe("archival context connections", () => {
  it("counts a record once even with multiple person roles", () => {
    assert.deepEqual(sharedContextRecords(rows, ["fran"]).map((r) => r.id), ["1", "2"]);
  });
  it("only shows shared letters containing every selected person", () => {
    assert.deepEqual(sharedContextRecords(rows, ["fran", "skip"]).map((r) => r.id), ["1"]);
  });
  it("does not count inaccessible records or invent empty connections", () => {
    assert.equal(sharedContextRecords(rows, ["skip"]).length, 1);
    assert.equal(sharedContextRecords(rows, []).length, 0);
  });
});