import { describe, expect, it } from "bun:test";
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
    expect(sharedContextRecords(rows, ["fran"]).map((r) => r.id)).toEqual(["1", "2"]);
  });
  it("only shows shared letters containing every selected person", () => {
    expect(sharedContextRecords(rows, ["fran", "skip"]).map((r) => r.id)).toEqual(["1"]);
  });
  it("does not count inaccessible records or invent empty connections", () => {
    expect(sharedContextRecords(rows, ["skip"]).length).toBe(1);
    expect(sharedContextRecords(rows, []).length).toBe(0);
  });
});