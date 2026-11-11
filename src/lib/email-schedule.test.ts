import assert from "node:assert/strict";
import { test } from "node:test";
import { emailSchedulePatch } from "./email-schedule";

  test("removes only the schedule, preserving recipients and every other field", () => {
    const email = { status: "scheduled", scheduled_for: "2026-11-12T14:00:00.000Z", recipients: [{ email: "family@example.com", name: "Family" }], subject: "Letter", message_body: "Original note", send_payload: { records: [{ kind: "letter", id: "fh-record" }], includeImages: true, attachments: [{ path: "original.jpg" }] } };
    const patch = emailSchedulePatch(null);
    assert.deepEqual(patch, { scheduled_for: null });
    assert.deepEqual({ ...email, ...patch }, { ...email, scheduled_for: null });
  });
  test("restores a future date without modifying email contents", () => {
    assert.deepEqual(emailSchedulePatch("2026-11-12T14:00:00Z", Date.parse("2026-11-11T14:00:00Z")), { scheduled_for: "2026-11-12T14:00:00.000Z" });
  });
  test("keeps the existing one-minute future scheduling requirement", () => {
    assert.throws(() => emailSchedulePatch("2026-11-11T14:00:30Z", Date.parse("2026-11-11T14:00:00Z")), /Pick a day in the future/);
  });