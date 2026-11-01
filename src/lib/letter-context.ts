export type ContextRecord = { id: string; archive_id: string; normalized_date: string | null };
export type ContextMembership = { person_id: string; letter_id: string; letters: ContextRecord | null };

/** Count each archival record once, regardless of how many roles a person has. */
export function sharedContextRecords(rows: ContextMembership[], personIds: string[]): ContextRecord[] {
  if (!personIds.length) return [];
  const groups = new Map<string, { record: ContextRecord; people: Set<string> }>();
  for (const row of rows) {
    if (!row.letters || !personIds.includes(row.person_id)) continue;
    const group = groups.get(row.letter_id) ?? { record: row.letters, people: new Set<string>() };
    group.people.add(row.person_id);
    groups.set(row.letter_id, group);
  }
  return [...groups.values()]
    .filter((group) => personIds.every((id) => group.people.has(id)))
    .map((group) => group.record)
    .sort((a, b) => (a.normalized_date ?? "9999").localeCompare(b.normalized_date ?? "9999") || a.archive_id.localeCompare(b.archive_id));
}