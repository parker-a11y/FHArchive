import assert from "node:assert/strict";
import { test } from "node:test";
import { canRetainAiReview, retainedReviewUpdates } from "./ai-review-override";
import { recordHealth } from "./record-health";

const changed = { id: "changed", status: "pending", content: "New AI wording", previous_content: "Previously reviewed wording" };

test("minor edit confirmation retains the reviewed wording and restores green", () => {
  const updates = retainedReviewUpdates([changed]);
  assert.deepEqual(updates, [{ id: "changed", status: "accepted", content: "Previously reviewed wording", previous_content: null, superseded_at: null }]);
  assert.equal(recordHealth({ scan_status: "scanned", transcription_status: "human_verified" }, { total: updates.length, pending: updates.filter((r) => r.status === "pending").length }).stage, "green");
});

test("override cannot bypass first-time AI review", () => {
  assert.equal(canRetainAiReview([]), false);
  assert.throws(() => retainedReviewUpdates([{ ...changed, previous_content: null }]));
});

test("existing accepted and rejected fields are left unchanged", () => {
  const rows = [{ ...changed, status: "accepted", previous_content: null }, { ...changed, id: "rejected", status: "rejected", previous_content: null }];
  assert.equal(canRetainAiReview(rows), true);
  assert.deepEqual(retainedReviewUpdates(rows), []);
});

test("retaining AI review does not bypass human transcription verification", () => {
  assert.equal(recordHealth({ scan_status: "scanned", transcription_status: "ai_transcribed" }, { total: 1, pending: 0 }).stage, "blue");
});