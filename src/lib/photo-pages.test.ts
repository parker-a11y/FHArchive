import assert from "node:assert/strict";
import { test } from "node:test";
import { galleryPhotoPagePaths, type GalleryPhotoRow } from "./photo-pages";
import { parsePhotoToken, photoToken } from "./inline-photos";

const photo = (patch: Partial<GalleryPhotoRow> = {}): GalleryPhotoRow => ({
  ph_id: "PH00016",
  caption: "Skip on the dock",
  front_path: "photos/a.tif",
  front_thumb_path: "photos/a_thumb.jpg",
  front_view_path: "photos/a_view.jpg",
  back_path: null,
  back_thumb_path: null,
  back_view_path: null,
  ...patch,
});

test("gallery photograph page 1 is the front viewing copy", () => {
  assert.deepEqual(galleryPhotoPagePaths(photo()), [{ path: "photos/a_view.jpg", label: "Front" }]);
});

test("gallery photograph page 2 is the back viewing copy when one exists", () => {
  const pages = galleryPhotoPagePaths(
    photo({ back_path: "photos/b.tif", back_thumb_path: "photos/b_thumb.jpg", back_view_path: "photos/b_view.jpg" }),
  );
  assert.deepEqual(pages, [
    { path: "photos/a_view.jpg", label: "Front" },
    { path: "photos/b_view.jpg", label: "Back" },
  ]);
});

test("gallery photograph falls back to the thumbnail when no viewing copy exists", () => {
  assert.deepEqual(galleryPhotoPagePaths(photo({ front_view_path: null })), [
    { path: "photos/a_thumb.jpg", label: "Front" },
  ]);
});

test("gallery photograph never offers a TIFF master", () => {
  assert.deepEqual(galleryPhotoPagePaths(photo({ front_view_path: null, front_thumb_path: null })), []);
  assert.deepEqual(
    galleryPhotoPagePaths(photo({ front_view_path: null, front_thumb_path: null, front_path: "photos/a.jpg" })),
    [{ path: "photos/a.jpg", label: "Front" }],
  );
});

test("a PH number and page round-trip through the parser the email renderer uses", () => {
  assert.deepEqual(parsePhotoToken(photoToken("PH00016", 2, "Fran drinking beer")), {
    identifier: "PH00016",
    page: 2,
  });
});
