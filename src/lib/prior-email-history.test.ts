import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveredEmailHistory, lastDistribution, priorEmailHistory, type HistoryEmail } from "./prior-email-history";

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
test("proof-only addresses do not count as previously sent", () => {
  const emails = ["PARKERJH@GMAIL.COM", "parker@tenfoldcapture.com"].map((email, i) => ({ id: String(i), recipients: [{ email }] }));
  assert.equal(priorEmailHistory(emails, [{ kind: "letter", id: "FH0001" }], new Set(["0", "1"])).sends.length, 0);
});
test("missing historical DS membership is unknown, never inferred from a subject", () => {
  const result = priorEmailHistory([{ id: "legacy", subject: "DS0007", recipients: [{ email: "family@example.com" }], send_payload: null }], [{ kind: "source", id: "DS0007" }], new Set());
  assert.equal(result.historyIncomplete, true);
  assert.equal(result.sends.length, 0);
});
test("last distribution returns the newest real send's recipients, skipping proof-only sends", () => {
  const emails: HistoryEmail[] = [
    { id: "proof", recipients: [{ email: "parkerjh@gmail.com" }] },
    { id: "real", subject: "FH0595", sent_at: "2026-10-30T15:00:00Z", recipients: [{ email: "parkerjh@gmail.com" }, { email: "family@example.com" }, { email: "cousin@example.com" }] },
  ];
  const last = lastDistribution(emails);
  assert.equal(last?.id, "real");
  assert.deepEqual(last?.recipients, ["parkerjh@gmail.com", "family@example.com", "cousin@example.com"]);
});
test("last distribution is null when only proof sends exist", () => {
  assert.equal(lastDistribution([{ id: "proof", recipients: [{ email: "parker@tenfoldcapture.com" }] }]), null);
});