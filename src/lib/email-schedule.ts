/** The archive's usual daily dispatch time. */
export const DEFAULT_SEND_TIME = "11:00";
export const DEFAULT_SEND_HOUR = 11;

/** Quick picks in the calendar scheduler; the default comes first. */
export const SEND_TIME_CHOICES = ["11:00", "09:00", "12:00", "14:00", "18:00"];

export function isSendTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Combines a calendar day (YYYY-MM-DD) and a HH:MM time into a local datetime value. */
export function joinDayAndTime(dayKey: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new Error("Pick a day first.");
  if (!isSendTime(time)) throw new Error("Pick a send time.");
  return `${dayKey}T${time}`;
}

/** "11:00" → "11:00 AM" for on-screen wording. */
export function formatSendTime(time: string) {
  if (!isSendTime(time)) return time;
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Only the dispatch time changes; the queued email and its payload stay intact. */
export function emailSchedulePatch(scheduledFor: string | null, now = Date.now()) {
  if (scheduledFor === null) return { scheduled_for: null };
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime())) throw new Error("That scheduled time is not valid.");
  if (when.getTime() < now + 60_000) throw new Error("Pick a day in the future.");
  return { scheduled_for: when.toISOString() };
}