/**
 * Note pictures live in the archive's private storage, so the display layer
 * asks the server for short-lived links. Older rows may still hold a plain
 * web address, which is used as-is.
 */
import { useQuery } from "@tanstack/react-query";
import { signNoteImages } from "@/lib/ffn.functions";
import type { FfnImage } from "@/lib/ffn";

export function useFfnImageUrls(images: Pick<FfnImage, "storage_path" | "image_url">[]) {
  const paths = images.map((i) => i.storage_path).filter((p): p is string => !!p);
  const { data: signed = {} } = useQuery({
    queryKey: ["ffn-image-urls", paths.slice().sort().join("|")],
    queryFn: () => signNoteImages({ data: { paths } }),
    enabled: paths.length > 0,
    staleTime: 1000 * 60 * 30,
  });
  return (img: Pick<FfnImage, "storage_path" | "image_url">) =>
    img.image_url ?? (img.storage_path ? signed[img.storage_path] : undefined);
}
