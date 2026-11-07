/**
 * Type-ahead suggestions for the "Date as written" field: days of the week
 * (and the common "Night" variants used in the archive). Free text still
 * wins — the list only suggests, it never restricts.
 */

export const DATE_AS_WRITTEN_LIST_ID = "date-as-written-options";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Day-of-week suggestions, matching the archive's most common phrasing. */
export const DATE_AS_WRITTEN_OPTIONS: string[] = [
  ...DAYS,
  ...DAYS.map((d) => `${d} Night`),
];

/** Datalist that powers type-ahead matching on any Date-as-written input. */
export function DateAsWrittenDatalist() {
  return (
    <datalist id={DATE_AS_WRITTEN_LIST_ID}>
      {DATE_AS_WRITTEN_OPTIONS.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}
