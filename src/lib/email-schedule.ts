/** Only the dispatch time changes; the queued email and its payload stay intact. */
export function emailSchedulePatch(scheduledFor: string | null, now = Date.now()) {
  if (scheduledFor === null) return { scheduled_for: null };
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime())) throw new Error("That scheduled time is not valid.");
  if (when.getTime() < now + 60_000) throw new Error("Pick a day in the future.");
  return { scheduled_for: when.toISOString() };
}