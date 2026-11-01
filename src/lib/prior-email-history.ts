export type HistoryRecord = { kind: "letter" | "source"; id: string };
export type HistoryEmail = {
  id: string;
  subject?: string;
  status?: string | null;
  sent_at?: string | null;
  scheduled_for?: string | null;
  created_at?: string | null;
  recipients?: { email?: string | null }[];
  send_payload?: { records?: HistoryRecord[] } | null;
  share_token?: string | null;
};
const PROOF_ADDRESSES = new Set(["parkerjh@gmail.com", "parker@tenfoldcapture.com"]);

export function priorEmailHistory(emails: HistoryEmail[], records: HistoryRecord[], loggedIds: Set<string>) {
  const requested = new Set(records.map((r) => `${r.kind}:${r.id}`));
  const delivered = emails.filter((e) => (e.recipients ?? []).some((r) => {
    const address = String(r.email ?? "").trim().toLowerCase();
    return address && !PROOF_ADDRESSES.has(address);
  }));
  return {
    historyIncomplete: records.some((r) => r.kind === "source") && delivered.some((e) => !e.send_payload),
    sends: delivered.filter((e) => loggedIds.has(e.id) || (e.send_payload?.records ?? []).some((r) => requested.has(`${r.kind}:${r.id}`)))
      .map((e) => ({
        id: e.id, subject: e.subject ?? "", sentAt: e.sent_at ?? e.scheduled_for ?? null,
        recipients: (e.recipients ?? []).map((r) => r.email ?? "").filter(Boolean),
        shareToken: e.share_token ?? null,
      })),
  };
}

/** When an email was written. Falls back to send/schedule time for older rows. */
function composedAt(email: HistoryEmail) {
  const value = email.created_at ?? email.sent_at ?? email.scheduled_for ?? "";
  const time = Date.parse(String(value));
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Recipients of the most recently composed email — draft, scheduled or sent.
 * A proof-only email (the archivist's own addresses) is not a distribution and
 * is skipped; proof addresses inside a real recipient list are kept.
 */
export function lastComposedEmail(emails: HistoryEmail[]) {
  const real = emails.filter((e) => (e.recipients ?? []).some((r) => {
    const address = String(r.email ?? "").trim().toLowerCase();
    return address && !PROOF_ADDRESSES.has(address);
  }));
  const last = [...real].sort((a, b) => composedAt(b) - composedAt(a))[0];
  if (!last) return null;
  return {
    id: last.id,
    subject: last.subject ?? "",
    status: last.status ?? null,
    composedAt: last.created_at ?? last.sent_at ?? last.scheduled_for ?? null,
    // Include every real recipient of that email (proof addresses too when they
    // were genuine recipients); only proof-only emails are skipped above.
    recipients: Array.from(new Map((last.recipients ?? [])
      .map((r) => String(r.email ?? "").trim())
      .filter(Boolean)
      .map((email) => [email.toLowerCase(), email] as const)).values()),
  };
}

/** Keep structured record membership after delivery without retaining the queued send command. */
export function deliveredEmailHistory(data: { records: HistoryRecord[]; includeTranscription: boolean; includeImages: boolean; includeEnvelope: boolean }) {
  return { records: data.records, includeTranscription: data.includeTranscription, includeImages: data.includeImages, includeEnvelope: data.includeEnvelope };
}