import assert from "node:assert/strict";
import { test } from "node:test";
import { autoScanLabels, nextAutoScanLabel, quickIdentifyChoices } from "./scan-rename";

test("postcards offer Front and Back first, matching the stored title-case subtype", () => {
  assert.deepEqual(quickIdentifyChoices("letter", "Postcard"), [
    "Front",
    "Back",
    "Enclosure",
    "Other",
  ]);
});

test("postcard chips survive stray spacing and capitalisation", () => {
  assert.deepEqual(quickIdentifyChoices("letter", "  POSTCARD "), [
    "Front",
    "Back",
    "Enclosure",
    "Other",
  ]);
});

test("telegram chips still work after the subtype fix", () => {
  assert.deepEqual(quickIdentifyChoices("letter", "Telegram"), [
    "Front",
    "Back",
    "Envelope Front",
    "Envelope Back",
    "Other",
  ]);
});

test("postcards name their uploads Front then Back automatically", () => {
  assert.deepEqual(autoScanLabels("letter", "Postcard"), ["Front", "Back"]);
});

test("other record types name nothing automatically", () => {
  assert.deepEqual(autoScanLabels("letter", "Personal letter"), []);
  assert.deepEqual(autoScanLabels("photograph", "Snapshot"), []);
  assert.deepEqual(autoScanLabels("letter", null), []);
});

test("the first postcard upload is named Front", () => {
  assert.equal(nextAutoScanLabel("letter", "Postcard", [null, null]), "Front");
});

test("the second postcard upload is named Back", () => {
  assert.equal(nextAutoScanLabel("letter", "Postcard", ["Front", null]), "Back");
});

test("used names are recognised whatever way they are written", () => {
  assert.equal(nextAutoScanLabel("letter", "Postcard", ["front", " BACK"]), null);
});

test("a third postcard scan is left for the usual naming paths", () => {
  assert.equal(nextAutoScanLabel("letter", "Postcard", ["Front", "Back", null]), null);
});

test("non-postcards never get an automatic name", () => {
  assert.equal(nextAutoScanLabel("letter", "Personal letter", [null]), null);
});
