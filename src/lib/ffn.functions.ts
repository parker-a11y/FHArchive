import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI drafting for Francis File Notes. Admin only; output is always a draft the
 * administrator edits and publishes by hand.
 */
export const draftFrancisFileNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { term: string; context?: string; section?: string }) => {
    if (!input?.term?.trim()) throw new Error("term is required");
    return {
      term: input.term.trim(),
      context: input.context?.slice(0, 4000),
      section: input.section,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: admin } = await supabase.rpc("is_admin", { _user_id: userId } as never);
    if (!admin) throw new Error("Only administrators can generate Francis File Notes");

    const { generateNoteDraft } = await import("./ffn.server");
    return await generateNoteDraft(data);
  });

/** Suggests credited images for a note term. Admin only. */
export const suggestNoteImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => {
    if (!input?.query?.trim()) throw new Error("query is required");
    return { query: input.query.trim().slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: admin } = await supabase.rpc("is_admin", { _user_id: userId } as never);
    if (!admin) throw new Error("Only administrators can search for images");
    const { searchNoteImages } = await import("./ffn.server");
    return await searchNoteImages(data.query);
  });

/** Downloads pictures into the archive's own storage. Admin only. */
export const importNoteImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      noteId: string;
      images: { url: string; caption?: string; credit?: string; rights?: string }[];
    }) => {
      if (!input?.noteId) throw new Error("noteId is required");
      if (!input.images?.length) throw new Error("No pictures selected");
      return { noteId: input.noteId, images: input.images.slice(0, 12) };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: admin } = await supabase.rpc("is_admin", { _user_id: userId } as never);
    if (!admin) throw new Error("Only administrators can add pictures");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("ffn_images")
      .select("id")
      .eq("note_id", data.noteId);
    let count = existing?.length ?? 0;
    const saved: string[] = [];

    for (const img of data.images) {
      const res = await fetch(img.url, { headers: { "User-Agent": "FrancisFilesArchive/1.0" } });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "image/jpeg";
      if (!type.startsWith("image/")) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const ext = (type.split("/")[1] ?? "jpg").split("+")[0].replace("jpeg", "jpg");
      const path = `${data.noteId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabaseAdmin.storage
        .from("ffn-images")
        .upload(path, bytes, { contentType: type, upsert: false });
      if (up.error) continue;
      const { error } = await supabaseAdmin.from("ffn_images").insert({
        note_id: data.noteId,
        image_url: null,
        storage_bucket: "ffn-images",
        storage_path: path,
        caption: img.caption?.trim() || null,
        credit: img.credit?.trim() || null,
        rights_note: [img.rights, img.url].filter(Boolean).join(" · ") || null,
        is_primary: count === 0,
        sort_order: count,
      } as never);
      if (error) continue;
      count += 1;
      saved.push(path);
    }
    if (!saved.length) throw new Error("None of the pictures could be saved");
    return { saved: saved.length };
  });

/** Signed links for stored note pictures. Public: note pages are readable by anyone. */
export const signNoteImages = createServerFn({ method: "POST" })
  .inputValidator((input: { paths: string[] }) => ({
    paths: (input?.paths ?? []).filter(Boolean).slice(0, 60),
  }))
  .handler(async ({ data }) => {
    if (!data.paths.length) return {} as Record<string, string>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("ffn-images")
      .createSignedUrls(data.paths, 60 * 60 * 24);
    const map: Record<string, string> = {};
    for (const s of signed ?? []) if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
    return map;
  });
