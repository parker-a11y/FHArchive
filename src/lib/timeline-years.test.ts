import assert from "node:assert/strict";
import { test } from "node:test";
import { timelineYears, UNDATED_YEAR, type YearBucket } from "./timeline-years";
import type { Letter } from "./queries";

const letter = (normalized_date: string | null): Letter => ({ normalized_date }) as Letter;

test("every year with a record gets a bucket, in chronological order", () => {
  const years = timelineYears([letter("1944-12-27"), letter("1943-01-05"), letter("1944-06-01"), letter("1946-02-02")]);
  assert.deepEqual(years, [
    { year: "1943", count: 1 },
    { year: "1944", count: 2 },
    { year: "1946", count: 1 },
  ] satisfies YearBucket[]);
});

test("undated records land in a final bucket instead of a fake year", () => {
  const years = timelineYears([letter(null), letter("1945-03-03"), letter("")]);
  assert.deepEqual(years.map((y) => y.year), ["1945", UNDATED_YEAR]);
  assert.equal(years[1].count, 2);
});

test("a year with no records never appears", () => {
  const years = timelineYears([letter("1943-01-01"), letter("1945-01-01")]);
  assert.deepEqual(years.map((y) => y.year), ["1943", "1945"]);
});
