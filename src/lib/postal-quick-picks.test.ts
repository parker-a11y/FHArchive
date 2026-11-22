import assert from "node:assert/strict";
import { test } from "node:test";
import {
  POSTAL_QUICK_PICKS,
  POSTAL_SERVICES,
  isPaidPostage,
} from "./postal";

test("postal quick picks are Stamped and Airmail", () => {
  assert.deepEqual(
    POSTAL_QUICK_PICKS.map((p) => p.label),
    ["Stamped", "Airmail"],
  );
});

test("quick picks set real postal service values, Stamped = paid postage", () => {
  const values = POSTAL_QUICK_PICKS.map((p) => p.value);
  assert.deepEqual(values, ["paid", "airmail"]);
  for (const v of values) {
    assert.ok(
      POSTAL_SERVICES.some((s) => s.value === v),
      `${v} must be a known postal service`,
    );
  }
  // Both markings count as paid postage when searching.
  assert.equal(isPaidPostage("paid"), true);
  assert.equal(isPaidPostage("airmail"), true);
});
