export type RecordKind = "letter" | "photo" | "source";
export type RecordKey = { kind: RecordKind; id: string };
export type CollectionRecord = {
  kind: RecordKind;
  ref_id: string;
  identifier: string;
  title: string | null;
  record_type: string | null;
  sort_date: string | null;
  date_text: string | null;
  author: string | null;
  recipient: string | null;
  origin: string | null;
  destination: string | null;
  body?: string;
};
export const recordKey = (r: RecordKey) => `${r.kind}:${r.id}`;
export function collectionDate(r: Pick<CollectionRecord, "sort_date" | "date_text">) {
  const written = r.date_text?.trim();
  const valid = written && !["none", "unknown", "undated", "n/a"].includes(written.toLowerCase());
  return r.sort_date
    ? `${r.sort_date}${valid && written !== r.sort_date ? ` · ${written}` : ""}`
    : valid
      ? written
      : "Undated";
}
export function membershipRows(collectionIds: string[], records: RecordKey[]) {
  const unique = new Map(records.map((r) => [recordKey(r), r]));
  return [...new Set(collectionIds)].flatMap((collection_id) =>
    [...unique.values()].map((r) => ({
      collection_id,
      letter_id: r.kind === "letter" ? r.id : null,
      photo_id: r.kind === "photo" ? r.id : null,
      source_id: r.kind === "source" ? r.id : null,
    })),
  );
}
export function eligibleSuggestions<T extends { kind: string; ref_id: string }>(
  candidates: T[],
  members: { kind: string | null; ref_id: string | null }[],
  dismissed: { kind: string | null; ref_id: string | null }[],
) {
  const excluded = new Set([...members, ...dismissed].map((r) => `${r.kind}:${r.ref_id}`));
  const seen = new Set<string>();
  return candidates.filter((r) => {
    const k = `${r.kind}:${r.ref_id}`;
    if (excluded.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
export function sortCollectionRecords(rows: CollectionRecord[], sort: string) {
  return [...rows].sort((a, b) =>
    sort === "number"
      ? a.identifier.localeCompare(b.identifier, undefined, { numeric: true })
      : sort === "title"
        ? (a.title ?? "").localeCompare(b.title ?? "")
        : ((a.sort_date ?? "9999").localeCompare(b.sort_date ?? "9999") ||
            a.identifier.localeCompare(b.identifier)) * (sort === "newest" ? -1 : 1),
  );
}
