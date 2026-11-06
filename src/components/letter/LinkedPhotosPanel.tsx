import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { viewPath } from "@/lib/photos";
import { CERTAINTY_LABEL, type Certainty } from "@/lib/photo-links";
import { SignedImg } from "@/components/photos/SignedImg";

type Row = { id: string; certainty: string; note: string | null; photos: { id: string; ph_id: string | null; caption: string | null; front_path: string | null; front_thumb_path: string | null; front_view_path: string | null } | null };

/** Photographs connected to this FH record through the Photo Organizer. Hidden when there are none. */
export function LinkedPhotosPanel({ letterId }: { letterId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["photo-links", "letter", letterId],
    queryFn: async () => {
      const { data, error } = await supabase.from("photo_links")
        .select("id,certainty,note,photos(id,ph_id,caption,front_path,front_thumb_path,front_view_path)")
        .eq("target_type", "letter").eq("target_id", letterId);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).filter((r) => r.photos);
    },
  });
  if (!data.length) return null;
  return (
    <section className="mb-4 rounded-md border bg-card p-3" aria-label="Linked photographs">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Camera className="size-4" /> {data.length === 1 ? "1 linked photograph" : `${data.length} linked photographs`}
      </p>
      <ul className="mt-2 flex flex-wrap gap-3">
        {data.map((r) => {
          const p = r.photos!;
          return (
            <li key={r.id} className="w-28">
              <a href={`/photos/${p.ph_id ?? ""}`} className="block">
                <div className="flex h-24 items-center justify-center overflow-hidden rounded bg-muted">
                  <SignedImg path={viewPath(p.front_path, p.front_thumb_path, p.front_view_path)} alt={p.caption || p.ph_id || "Photograph"} className="h-full w-full object-contain" />
                </div>
                <p className="mt-1 font-mono text-xs">{p.ph_id ?? "Unnumbered"}</p>
                {p.caption && <p className="truncate text-xs">{p.caption}</p>}
                <p className="text-[11px] text-muted-foreground">{CERTAINTY_LABEL[r.certainty as Certainty]}</p>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
