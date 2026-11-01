export type ReviewSuggestion = {
  id: string;
  status: string | null;
  content: string | null;
  previous_content: string | null;
};

/** Only an existing review can be retained; first-time suggestions still need review. */
export function canRetainAiReview(rows: ReviewSuggestion[]) {
  return rows.length > 0 && rows.every((row) =>
    row.status === "accepted" || row.status === "rejected" ||
    (row.status === "pending" && Boolean(row.previous_content?.trim())),
  );
}

export function retainedReviewUpdates(rows: ReviewSuggestion[]) {
  if (!canRetainAiReview(rows)) {
    throw new Error("Review the original AI suggestions before confirming that another analysis is unnecessary.");
  }
  return rows.filter((row) => row.status === "pending").map((row) => ({
    id: row.id,
    status: "accepted",
    content: row.previous_content,
    previous_content: null,
    superseded_at: null,
  }));
}