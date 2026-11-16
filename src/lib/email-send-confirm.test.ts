import assert from "node:assert/strict";
import { test } from "node:test";
import { describeSendConfirm } from "./email-send-confirm";

const base = {
  recipients: [{ email: "parkerjh@gmail.com" }, { email: "faharrington3@me.com" }],
  subject: "Navigation by Day",
  later: false,
  sendAt: "",
  includeImages: true,
  includeEnvelope: true,
  includeTranscription: true,
  hasLetter: true,
  blogMode: false,
};

test("asks before an immediate send and names every recipient", () => {
  const s = describeSendConfirm(base);
  assert.equal(s?.title, "Send this email now?");
  assert.equal(s?.actionLabel, "Send now");
  assert.equal(s?.recipientCount, 2);
  assert.deepEqual(s?.recipientEmails, ["parkerjh@gmail.com", "faharrington3@me.com"]);
  assert.equal(s?.when, "Immediately");
  assert.equal(s?.subject, "Navigation by Day");
});

test("wording switches to scheduling when a time is picked", () => {
  const s = describeSendConfirm({ ...base, later: true, sendAt: "2026-11-20T11:00" });
  assert.equal(s?.title, "Schedule this email?");
  assert.equal(s?.actionLabel, "Schedule email");
  assert.notEqual(s?.when, "Immediately");
  assert.match(s?.when ?? "", /2026/);
});

test("sends immediately when 'Send later' is ticked but no time was picked", () => {
  const s = describeSendConfirm({ ...base, later: true, sendAt: "" });
  assert.equal(s?.actionLabel, "Send now");
  assert.equal(s?.when, "Immediately");
});

test("lists only the content actually switched on", () => {
  const s = describeSendConfirm({
    ...base,
    includeImages: false,
    includeEnvelope: false,
    includeTranscription: true,
  });
  assert.deepEqual(s?.contents, ["the transcription"]);
});

test("never offers an envelope line for records that are not letters", () => {
  const s = describeSendConfirm({ ...base, hasLetter: false });
  assert.ok(!s?.contents.includes("the envelope scan"));
});

test("shows a placeholder when the subject is blank", () => {
  assert.equal(describeSendConfirm({ ...base, subject: "   " })?.subject, "(no subject)");
});

test("does not confirm a blog post, which mails nobody", () => {
  assert.equal(describeSendConfirm({ ...base, blogMode: true }), null);
});
