/**
 * Shared traffic-light health summary for an FH record.
 *
 * Green — nothing outstanding (verified transcription, or none required).
 * Yellow — scans present, transcription still pending.
 * Red — no scans yet, or a transcription failure to look at.
 */
export type RecordHealthInput = {
  scan_status?: string | null;
  transcription_status?: string | null;
};

export function recordHealth(l: RecordHealthInput): { color: string; label: string } {
  if (l.transcription_status === "not_required")
    return { color: "#28C840", label: "Transcription not required for this record" };
  if (l.scan_status === "not_scanned" || l.transcription_status === "failed")
    return { color: "#FF5F57", label: "No scans or a problem detected with this record" };
  if (l.transcription_status === "human_verified")
    return { color: "#28C840", label: "Transcribed, AI summary, human checked" };
  return { color: "#FEBC2E", label: "Scans uploaded, transcription pending" };
}
