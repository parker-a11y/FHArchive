import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { photoEmailMessage, photoEmailSubject } from "@/lib/photo-email";
import type { Photo } from "@/lib/photos";

/** Opens the regular archive email composer with the chosen photographs embedded, ready for a personal message. */
export function EmailPhotosButton({ photos, label = "Email" }: { photos: Photo[]; label?: string }) {
  if (!photos.length) return null;
  const key = photos.map((p) => p.ph_id ?? p.id).join(",");
  return (
    <EmailArchiveDialog
      key={key}
      autosaveScope={`photos:${key}`}
      defaultSubject={photoEmailSubject(photos)}
      defaultMessage={"\n\n" + photoEmailMessage(photos, true)}
      trigger={<Button size="sm" variant="outline" className="gap-1"><Mail className="size-4" />{label}</Button>}
    />
  );
}
