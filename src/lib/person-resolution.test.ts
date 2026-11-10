import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePersonMatches } from "./person-resolution";

const francis = { id: "francis", name: "Francis A. Harrington", matched_on: "Fran", score: 1 };
const striker = { id: "striker", name: "Fran Striker", matched_on: "Fran Striker", score: 1 };

test("standalone Fran resolves to Francis even when fuzzy matches score 100%", () => {
  for (const name of ["Fran", "FRAN", "fran", " Fran "]) {
    assert.deepEqual(resolvePersonMatches(name, [striker, francis]), {
      kind: "exact", person: { id: "francis", name: "Francis A. Harrington" },
    });
  }
});

test("longer Fran names remain their own people", () => {
  assert.deepEqual(resolvePersonMatches("Fran Striker", [francis, striker]), {
    kind: "exact", person: { id: "striker", name: "Fran Striker" },
  });
});

test("a nickname shared by two people requires confirmation", () => {
  const other = { ...striker, matched_on: "Fran" };
  assert.deepEqual(resolvePersonMatches("Fran", [francis, other]), {
    kind: "ambiguous", candidates: [francis, other],
  });
});