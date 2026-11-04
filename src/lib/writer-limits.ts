/** How many letters the Writing Assistant reads in one session. */
export const WRITER_MAX_RECORDS = 25;

/**
 * Keeps a record list within the assistant's per-session limit.
 * Returns the attached records plus the ones left out, in the order given.
 */
export function fitWriterIds(ids: string[]): { ids: string[]; dropped: string[] } {
  const unique = Array.from(new Set(ids));
  return { ids: unique.slice(0, WRITER_MAX_RECORDS), dropped: unique.slice(WRITER_MAX_RECORDS) };
}
