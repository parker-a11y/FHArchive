import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SEND_TIME,
  SEND_TIME_CHOICES,
  formatSendTime,
  isSendTime,
  joinDayAndTime,
} from "./email-schedule";
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
  test("offers 11:00 AM as the default pick in the calendar scheduler", () => {
    assert.equal(DEFAULT_SEND_TIME, "11:00");
    assert.equal(SEND_TIME_CHOICES[0], "11:00");
    assert.equal(formatSendTime(DEFAULT_SEND_TIME), "11:00 AM");
  });
  test("combines a saved day and time into one local datetime", () => {
    assert.equal(joinDayAndTime("2026-11-16", "11:00"), "2026-11-16T11:00");
    assert.equal(joinDayAndTime("2026-11-16", "09:30"), "2026-11-16T09:30");
  });
  test("refuses to save without a valid time", () => {
    assert.equal(isSendTime(""), false);
    assert.equal(isSendTime("25:00"), false);
    assert.throws(() => joinDayAndTime("2026-11-16", ""), /Pick a send time/);
    assert.throws(() => joinDayAndTime("not-a-day", "11:00"), /Pick a day first/);
  });