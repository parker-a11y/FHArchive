export type HistoryRecord = { kind: "letter" | "source"; id: string };
export type HistoryEmail = {
  id: string;
  subject?: string;
  sent_at?: string | null;
  scheduled_for?: string | null;
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

/** Keep structured record membership after delivery without retaining the queued send command. */
export function deliveredEmailHistory(data: { records: HistoryRecord[]; includeTranscription: boolean; includeImages: boolean; includeEnvelope: boolean }) {
  return { records: data.records, includeTranscription: data.includeTranscription, includeImages: data.includeImages, includeEnvelope: data.includeEnvelope };
}