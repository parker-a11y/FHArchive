/** Never interpret pending, failed, or refetching file reads as an empty archive. */
export function scanSummaryPatch(
  ready: boolean,
  count: number,
  current: { image_count: number | null; scan_status: string | null },
) {
  if (!ready) return null;
  const scan_status = count > 0 ? "scanned" : "not_scanned";
  if (current.image_count === count && current.scan_status === scan_status) return null;
  return { image_count: count, scan_status };
}