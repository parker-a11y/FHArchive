/**
 * Gallery photograph pages, shared by the photo picker and the email renderer
 * so the page number written into a `[[photo:PH00016:2]]` token always resolves
 * to the same picture. Page 1 is the front, page 2 the back when one exists.
 *
 * Browser-safe: no Supabase client here, only path arithmetic.
 */
export type GalleryPhotoRow = {
  ph_id: string | null;
  caption: string | null;
  front_path: string | null;
  front_thumb_path: string | null;
  front_view_path: string | null;
  back_path: string | null;
  back_thumb_path: string | null;
  back_view_path: string | null;
};

/** Columns every gallery photograph reader needs to build the same page list. */
export const GALLERY_PHOTO_COLS =
  "ph_id, caption, front_path, front_thumb_path, front_view_path, back_path, back_thumb_path, back_view_path";

/**
 * Best embeddable image for one side: the large viewing copy, then the
 * thumbnail, then an original the browser can actually show. A TIFF master is
 * never returned — it renders as a broken image in an email.
 */
function bestPath(view: string | null, thumb: string | null, master: string | null) {
  if (view) return view;
  if (thumb) return thumb;
  return master && !/\.tiff?$/i.test(master) ? master : null;
}

/** The photograph's pages in token order: 1 = front, 2 = back. */
export function galleryPhotoPagePaths(row: GalleryPhotoRow): { path: string; label: string }[] {
  const pages: { path: string; label: string }[] = [];
  const front = bestPath(row.front_view_path, row.front_thumb_path, row.front_path);
  if (front) pages.push({ path: front, label: "Front" });
  const back = bestPath(row.back_view_path, row.back_thumb_path, row.back_path);
  if (back) pages.push({ path: back, label: "Back" });
  return pages;
}
