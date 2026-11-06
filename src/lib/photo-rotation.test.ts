import assert from "node:assert/strict";
import { test } from "node:test";
import { photoRotationSources } from "./photo-rotation";

test("rotation uses viewing copies instead of the archival TIFF", () => {
  assert.deepEqual(photoRotationSources({ front_path: "master.tif", front_view_path: "view.jpg", front_thumb_path: "thumb.jpg" }), { view: "view.jpg", thumb: "thumb.jpg" });
});
test("a photo without derivatives reads its JPEG original without overwriting it", () => {
  assert.deepEqual(photoRotationSources({ front_path: "master.jpg", front_view_path: null, front_thumb_path: null }), { view: "master.jpg", thumb: "master.jpg" });
});
test("TIFF originals cannot be used as browser viewing copies", () => {
  assert.throws(() => photoRotationSources({ front_path: "master.TIFF", front_view_path: null, front_thumb_path: null }), /viewing copy/);
});