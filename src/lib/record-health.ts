/**
 * Shared traffic-light health summary for an FH record.
 *
 * Green — nothing outstanding (verified transcription with AI review done, or
 *   transcription not required).
 * Purple — transcription verified, AI analysis review not finished.
 * Blue — AI transcribed, awaiting human verification.
 * Yellow — scans present, transcription still pending.
 * Red — no scans yet, or a transcription failure to look at.
 */
export type RecordHealthInput = {
  scan_status?: string | null;
  transcription_status?: string | null;
};

/** AI-analysis review state for a record: any suggestions, any still pending. */
export type RecordAiState = { total: number; pending: number } | undefined;

export type RecordHealthStage = "green" | "purple" | "blue" | "yellow" | "red";

export const HEALTH_COLORS: Record<RecordHealthStage, string> = {
  green: "#28C840",
  purple: "#8B5CF6",
  blue: "#3B82F6",
  yellow: "#FEBC2E",
  red: "#FF5F57",
};

export function recordHealth(
  l: RecordHealthInput,
  ai?: RecordAiState,
): { color: string; label: string; stage: RecordHealthStage } {
  const aiDone = Boolean(ai && ai.total > 0 && ai.pending === 0);

  if (l.transcription_status === "not_required")
    return {
      stage: "green",
      color: HEALTH_COLORS.green,
      label: "Transcription not required for this record",
    };

  if (l.scan_status === "not_scanned" || l.transcription_status === "failed")
    return {
      stage: "red",
      color: HEALTH_COLORS.red,
      label: "No scans or a problem detected with this record",
    };

  if (l.transcription_status === "human_verified")
    return aiDone
      ? {
          stage: "green",
          color: HEALTH_COLORS.green,
          label: "Transcribed, verified, AI analysis reviewed",
        }
      : {
          stage: "purple",
          color: HEALTH_COLORS.purple,
          label: "Transcription verified — AI analysis review not finished",
        };

  if (l.transcription_status === "ai_transcribed")
    return {
      stage: "blue",
      color: HEALTH_COLORS.blue,
      label: "Transcribed by AI — awaiting human verification",
    };

  return {
    stage: "yellow",
    color: HEALTH_COLORS.yellow,
    label: "Scans uploaded, transcription pending",
  };
}
