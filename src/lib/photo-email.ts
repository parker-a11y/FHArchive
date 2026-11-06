import { photoToken } from "@/lib/inline-photos";

type P = { ph_id: string | null; caption: string | null; back_view_path?: string | null };

/** Email body embedding each selected photograph (front, plus back when scanned) by PH number. */
export function photoEmailMessage(photos: readonly P[], includeBacks = false): string {
  return photos
    .filter((p) => p.ph_id)
    .map((p) => {
      const front = photoToken(p.ph_id!, 1, [p.ph_id, p.caption].filter(Boolean).join(" — "));
      const back = includeBacks && p.back_view_path ? "\n\n" + photoToken(p.ph_id!, 2, `${p.ph_id} — reverse`) : "";
      return front + back;
    })
    .join("\n\n");
}

export function photoEmailSubject(photos: readonly P[]): string {
  if (photos.length === 1) return photos[0]!.caption?.trim() || `Photograph ${photos[0]!.ph_id ?? ""}`.trim();
  return `${photos.length} photographs from the Francis Files`;
}
