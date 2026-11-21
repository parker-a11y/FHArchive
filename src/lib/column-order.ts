/** Retain known saved columns once, then append newly introduced columns. */
export function normalizeColumnOrder(saved: unknown, defaults: readonly string[]): string[] {
  const known = new Set(defaults);
  const restored = Array.isArray(saved)
    ? saved.filter((key): key is string => typeof key === "string" && known.has(key))
    : [];
  return [...new Set([...restored, ...defaults])];
}

/** Move a column across an explicit before/after drop boundary. */
export function moveColumn(order: readonly string[], source: string, target: string, after = false): string[] {
  if (source === target || !order.includes(source) || !order.includes(target)) return [...order];
  const next = order.filter((key) => key !== source);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, source);
  return next;
}