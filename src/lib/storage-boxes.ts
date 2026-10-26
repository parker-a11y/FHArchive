export type StorageBoxRecord = {
  id: string;
  archive_id: string;
  fh_seq: number;
  title: string | null;
  record_type: string;
  storage_location: string | null;
  storage_type: string;
  storage_folder: string | null;
  normalized_date: string | null;
  date_end: string | null;
  date_as_written: string | null;
  date_precision: string;
  date_certainty: string;
  date_from_postmark: boolean | null;
};

export function groupStorageBoxes<T extends Pick<StorageBoxRecord, "storage_location" | "fh_seq">>(records: T[]) {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const name = record.storage_location?.trim() || "";
    const rows = groups.get(name) ?? [];
    rows.push(record);
    groups.set(name, rows);
  }
  return [...groups].map(([name, rows]) => ({
    name,
    records: rows.sort((a, b) => a.fh_seq - b.fh_seq),
  })).sort((a, b) => {
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}