import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveredEmailHistory, lastComposedEmail, priorEmailHistory, type HistoryEmail } from "./prior-email-history";

test("source membership survives delivery and matches only the selected DS record", () => {
  const payload = deliveredEmailHistory({ records: [{ kind: "source", id: "DS0007" }], includeImages: true, includeEnvelope: true, includeTranscription: true });
  const email = { id: "sent-source", recipients: [{ email: "family@example.com" }], send_payload: payload };
  assert.deepEqual(priorEmailHistory([email], [{ kind: "source", id: "DS0007" }], new Set()).sends.map((e) => e.id), ["sent-source"]);
  assert.equal(priorEmailHistory([email], [{ kind: "source", id: "DS0008" }], new Set()).sends.length, 0);
});
test("a letter's prior send is not dropped beyond the newest 300 emails", () => {
  const emails: HistoryEmail[] = Array.from({ length: 601 }, (_, i) => ({ id: `email-${i}`, recipients: [{ email: "family@example.com" }] }));
  assert.deepEqual(priorEmailHistory(emails, [{ kind: "letter", id: "FH0001" }], new Set(["email-600"])).sends.map((e) => e.id), ["email-600"]);
});
test("record email links retain the matching email ID, date and recipient list", () => {
  const result = priorEmailHistory([
    { id: "sent-letter", subject: "FH0400", sent_at: "2026-11-06T15:00:00Z", recipients: [{ email: "family@example.com" }, { email: "cousin@example.com" }] },
    { id: "other-letter", recipients: [{ email: "other@example.com" }] },
  ], [{ kind: "letter", id: "letter-400" }], new Set(["sent-letter"]));
  assert.deepEqual(result.sends, [{ id: "sent-letter", subject: "FH0400", sentAt: "2026-11-06T15:00:00Z", recipients: ["family@example.com", "cousin@example.com"], shareToken: null }]);
});
test("proof-only addresses do not count as previously sent", () => {
  const emails = ["PARKERJH@GMAIL.COM", "parker@tenfoldcapture.com"].map((email, i) => ({ id: String(i), recipients: [{ email }] }));
  assert.equal(priorEmailHistory(emails, [{ kind: "letter", id: "FH0001" }], new Set(["0", "1"])).sends.length, 0);
});
test("missing historical DS membership is unknown, never inferred from a subject", () => {
  const result = priorEmailHistory([{ id: "legacy", subject: "DS0007", recipients: [{ email: "family@example.com" }], send_payload: null }], [{ kind: "source", id: "DS0007" }], new Set());
  assert.equal(result.historyIncomplete, true);
  assert.equal(result.sends.length, 0);
});
test("last composed returns the newest email's recipients, keeping proof addresses in a real list", () => {
  const emails: HistoryEmail[] = [
    { id: "older-send", subject: "FH0595", status: "sent", created_at: "2026-10-30 15:00:00+00", recipients: [{ email: "parkerjh@gmail.com" }, { email: "family@example.com" }, { email: "cousin@example.com" }] },
    { id: "newer-draft", subject: "Room at the Seymour", status: "draft", created_at: "2026-11-01 21:02:24.733407+00", recipients: [{ email: "parkerjh@gmail.com" }, { email: "cailinrh@gmail.com" }] },
  ];
  const last = lastComposedEmail(emails);
  assert.equal(last?.id, "newer-draft");
  assert.deepEqual(last?.recipients, ["parkerjh@gmail.com", "cailinrh@gmail.com"]);
});
test("last composed ignores input order and picks the most recently written email", () => {
  const emails: HistoryEmail[] = [
    { id: "scheduled", subject: "Scheduled", status: "scheduled", created_at: "2026-10-28 12:00:00+00", recipients: [{ email: "aunt@example.com" }] },
    { id: "oldest", subject: "Oldest", status: "sent", created_at: "2026-10-20 09:00:00+00", recipients: [{ email: "old@example.com" }] },
    { id: "draft", subject: "Fresh draft", status: "draft", created_at: "2026-11-01 21:02:24.733407+00", recipients: [{ email: "cousin@example.com" }] },
  ];
  assert.equal(lastComposedEmail(emails)?.id, "draft");
});
test("last composed skips a proof-only email and falls back to the next newest", () => {
  const emails: HistoryEmail[] = [
    { id: "proof", status: "draft", created_at: "2026-11-01 22:00:00+00", recipients: [{ email: "PARKERJH@GMAIL.COM" }] },
    { id: "real", status: "sent", created_at: "2026-10-30 15:00:00+00", recipients: [{ email: "family@example.com" }] },
  ];
  assert.equal(lastComposedEmail(emails)?.id, "real");
});
test("last composed is null when only proof emails exist", () => {
  assert.equal(lastComposedEmail([{ id: "proof", recipients: [{ email: "parker@tenfoldcapture.com" }] }]), null);
});
