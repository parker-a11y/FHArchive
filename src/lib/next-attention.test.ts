import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAttentionRecord, type AttentionRecord } from "./next-attention";

const row = (seq: number, status = "human_verified", scan = "scanned"): AttentionRecord => ({
  id: String(seq), fh_seq: seq, archive_id: `FH${String(seq).padStart(4, "0")}`,
  record_type: "letter", transcription_status: status, scan_status: scan,
});

test("go DOWN from FH0815 to the nearest lower non-green record, never up or to itself", () => {
  assert.equal(nextAttentionRecord(815, [row(816), row(815), row(790), row(813), row(814)],
    { "814": { total: 11, pending: 0 } })?.archive_id, "FH0813");
});
test("skip all green records, including transcription not required", () => {
  assert.equal(nextAttentionRecord(815, [row(814), row(813, "not_required"), row(812, "ai_transcribed")],
    { "814": { total: 11, pending: 0 } })?.archive_id, "FH0812");
});
for (const [stage, status, scan, ai] of [
  ["purple", "human_verified", "scanned", { total: 11, pending: 1 }],
  ["blue", "ai_transcribed", "scanned", undefined],
  ["yellow", "not_started", "scanned", undefined],
  ["red", "not_started", "not_scanned", undefined],
] as const) {
  test(`include ${stage} as NON GREEN`, () => {
    assert.equal(nextAttentionRecord(815, [row(814, status, scan)], { "814": ai })?.archive_id, "FH0814");
  });
}
test("do not wrap at the bottom or navigate to photographs moved out of FH", () => {
  assert.equal(nextAttentionRecord(1, [row(1), row(2)], {}), undefined);
  assert.equal(nextAttentionRecord(815, [{ ...row(814), record_type: "moved_to_gallery" }], {}), undefined);
});