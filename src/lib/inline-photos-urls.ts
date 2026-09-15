import { useQuery } from "@tanstack/react-query";
import { signInlinePhotos } from "@/lib/inline-photos.functions";
import { extractPhotoTokens, type InlinePhoto } from "@/lib/inline-photos";

/** Signed URLs for every photo token in a body of text, for on-site display. */
export function useInlinePhotos(text: string): Record<string, InlinePhoto> {
  const tokens = extractPhotoTokens(text);
  const { data = {} } = useQuery({
    queryKey: ["inline-photos", tokens.slice().sort().join("|")],
    queryFn: () => signInlinePhotos({ data: { text: tokens.join("\n") } }),
    enabled: tokens.length > 0,
    staleTime: 1000 * 60 * 30,
  });
  return data;
}
