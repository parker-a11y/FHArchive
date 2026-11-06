import { useMemo } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { galleryOptions } from "@/routes/_authenticated/photos";
import { linksByPhoto, type CategoryLink } from "@/lib/photo-catalog";

/** Shared photo/category/box data for the organizer tools, with optimistic link edits. */
export function usePhotoData() {
  const { data } = useSuspenseQuery(galleryOptions);
  const qc = useQueryClient();
  const byPhoto = useMemo(() => linksByPhoto(data.links), [data.links]);
  const catName = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories]);
  const boxById = useMemo(() => new Map(data.boxes.map((b) => [b.id, b])), [data.boxes]);
  const refresh = () => qc.invalidateQueries({ queryKey: galleryOptions.queryKey });
  const patchLinks = (fn: (links: CategoryLink[]) => CategoryLink[]) =>
    qc.setQueryData(galleryOptions.queryKey, (old) => (old ? { ...old, links: fn(old.links) } : old));
  const patch = (fn: (d: typeof data) => typeof data) => qc.setQueryData(galleryOptions.queryKey, (old) => (old ? fn(old) : old));
  return { ...data, byPhoto, catName, boxById, refresh, patchLinks, patch };
}
