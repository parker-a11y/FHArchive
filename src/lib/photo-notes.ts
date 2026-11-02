/** Fold an old FH photo record's details into the single gallery Notes field. */
export type LegacyPhotoFields = {
  archive_id: string;
  date_as_written?: string | null;
  normalized_date?: string | null;
  photo_back_inscription?: string | null;
  primary_person?: string | null;
  origin?: string | null;
  photographer?: string | null;
  photo_occasion?: string | null;
  storage_location?: string | null;
  notes?: string | null;
};

export function legacyPhotoNotes(l: LegacyPhotoFields): string {
  const rows: [string, string | null | undefined][] = [
    ["Date", l.date_as_written?.trim() || l.normalized_date],
    ["Writing on back", l.photo_back_inscription],
    ["People", l.primary_person],
    ["Place", l.origin],
    ["Photographer", l.photographer],
    ["Occasion", l.photo_occasion],
    ["Box", l.storage_location],
    ["Notes", l.notes],
  ];
  const lines = rows.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${String(v).trim()}`);
  lines.push(`Formerly ${l.archive_id}`);
  return lines.join("\n");
}
