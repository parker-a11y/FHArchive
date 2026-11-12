import { describe, expect, it } from "vitest";
import { unprintedRun } from "./multi-label";

const recs = [10, 9, 8, 7, 6].map((n) => ({ id: `r${n}`, fh_seq: n }));

describe("unprintedRun", () => {
  it("stops at the last previously printed label", () => {
    expect(unprintedRun(recs, new Set(["r7"])).map((r) => r.fh_seq)).toEqual([10, 9, 8]);
  });
  it("stops immediately when the current record is printed", () => {
    expect(unprintedRun(recs, new Set(["r10"]))).toEqual([]);
  });
  it("caps the run length", () => {
    expect(unprintedRun(recs, new Set(), 2).map((r) => r.fh_seq)).toEqual([10, 9]);
  });
});
