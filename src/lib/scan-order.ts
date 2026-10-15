export type ScanDropTarget = { id: string; side: "before" | "after" };

/** Resolve the insertion boundary after removing the dragged item. */
export function reorderScans<T extends { id: string }>(
  files: readonly T[],
  draggedId: string,
  target: ScanDropTarget,
): T[] {
  const moved = files.find((file) => file.id === draggedId);
  if (!moved || draggedId === target.id) return [...files];
  const remaining = files.filter((file) => file.id !== draggedId);
  const index = remaining.findIndex((file) => file.id === target.id);
  if (index < 0) return [...files];
  remaining.splice(index + (target.side === "after" ? 1 : 0), 0, moved);
  return remaining;
}