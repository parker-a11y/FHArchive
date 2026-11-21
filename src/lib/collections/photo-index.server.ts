import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { embedTexts } from "@/lib/research/embed.server";

/** A shared derived index; originals are only read, and all passages are retained. */
export async function indexCollectionPhotos(client: SupabaseClient<Database>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let offset = 0; ; offset += 40) {
    const { data: photos, error } = await client
      .from("collection_archive_records")
      .select("*")
      .eq("kind", "photo")
      .order("ref_id")
      .range(offset, offset + 39);
    if (error) throw error;
    const rows = photos ?? [];
    if (!rows.length) break;
    const ids = rows.flatMap((p) => (p.ref_id ? [p.ref_id] : []));
    const { data: existing, error: cacheError } = await supabaseAdmin
      .from("collection_photo_vectors")
      .select("photo_id,fingerprint")
      .in("photo_id", ids);
    if (cacheError) throw cacheError;
    const pending: { photoId: string; fingerprint: string; passages: string[] }[] = [];
    for (const photo of rows) {
      if (!photo.ref_id) continue;
      const text = JSON.stringify(photo);
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      const fingerprint = Array.from(new Uint8Array(hash), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
      if (existing?.some((e) => e.photo_id === photo.ref_id && e.fingerprint === fingerprint))
        continue;
      const passages: string[] = [];
      for (let i = 0; i < text.length; i += 1000) passages.push(text.slice(i, i + 1200));
      pending.push({ photoId: photo.ref_id, fingerprint, passages });
    }
    const allVectors = await embedTexts(pending.flatMap((p) => p.passages));
    let cursor = 0;
    for (const photo of pending) {
      const { passages, fingerprint } = photo;
      const vectors = allVectors.slice(cursor, cursor + passages.length);
      cursor += passages.length;
      const first = vectors[0];
      if (!first || first.length !== 3072)
        throw new Error("Photo meaning-search returned an invalid vector.");
      const mean = first.map(
        (_, i) => vectors.reduce((sum, v) => sum + (v[i] ?? 0), 0) / vectors.length,
      );
      const { error } = await supabaseAdmin
        .from("collection_photo_vectors")
        .upsert({
          photo_id: photo.photoId,
          fingerprint,
          embedding: JSON.stringify(mean),
          chunks: passages.map((content, i) => ({ content, embedding: vectors[i] ?? [] })),
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    }
    if (rows.length < 40) break;
  }
}
