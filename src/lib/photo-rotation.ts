/** Only viewing copies may be rotated; original scans remain untouched. */
export function photoRotationSources(photo: {
  front_path: string;
  front_view_path: string | null;
  front_thumb_path: string | null;
}) {
  const view = photo.front_view_path ?? photo.front_thumb_path ??
    (/\.tiff?$/i.test(photo.front_path) ? null : photo.front_path);
  if (!view) throw new Error("Create a viewing copy before rotating this photograph.");
  return { view, thumb: photo.front_thumb_path ?? view };
}