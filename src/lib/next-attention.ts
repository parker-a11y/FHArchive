import { recordHealth, type RecordAiState, type RecordHealthInput } from "./record-health";

// Every record found by NEXT NEED ATTENTION lands on its Transcription tab,
// whichever tab the button was clicked from.
export const ATTENTION_LAND_TAB = "transcription";

export type AttentionRecord = RecordHealthInput & {
  id: string;
  fh_seq: number;
  archive_id: string;
  record_type: string;
};

export function nextAttentionRecord(
  currentSequence: number,
  records: AttentionRecord[],
  ai: Record<string, RecordAiState>,
): AttentionRecord | undefined {
  return records
    .filter((r) => r.fh_seq < currentSequence && r.record_type !== "moved_to_gallery"
      && recordHealth(r, ai[r.id]).stage !== "green")
    .sort((a, b) => b.fh_seq - a.fh_seq)[0];
}