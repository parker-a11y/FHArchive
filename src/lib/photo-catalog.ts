/** Categories, category links, upload batches and photo boxes for the PH catalog. */
import { supabase } from "@/integrations/supabase/client";
import { categoryKey, normalizeBoxCode, parsePhotoYears } from "@/lib/photo-archive";

export type PhotoCategory = { id: string; name: string; sort_order: number };
export type PhotoBox = { id: string; code: string; name: string | null; location: string | null };
export type PhotoBatch = { id: string; name: string | null; created_at: string };
export type CategoryLink = { photo_id: string; category_id: string };

export async function fetchCategories(): Promise<PhotoCategory[]> {
  const { data, error } = await supabase.from("photo_categories").select("id, name, sort_order").order("sort_order").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchCategoryLinks(): Promise<CategoryLink[]> {
  const out: CategoryLink[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("photo_category_links").select("photo_id, category_id").order("photo_id").order("category_id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export function linksByPhoto(links: readonly CategoryLink[]) {
  const m = new Map<string, string[]>();
  for (const l of links) {
    const a = m.get(l.photo_id) ?? [];
    a.push(l.category_id);
    m.set(l.photo_id, a);
  }
  return m;
}

export async function createCategory(name: string, existing: readonly PhotoCategory[]): Promise<PhotoCategory> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Enter a category name");
  const dup = existing.find((c) => categoryKey(c.name) === categoryKey(clean));
  if (dup) return dup;
  const sort = Math.max(0, ...existing.map((c) => c.sort_order)) + 1;
  const { data, error } = await supabase.from("photo_categories").insert({ name: clean, sort_order: sort }).select("id, name, sort_order").single();
  if (error) throw error;
  return data;
}

export async function renameCategory(id: string, name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Enter a category name");
  const { error } = await supabase.from("photo_categories").update({ name: clean }).eq("id", id);
  if (error) throw error.code === "23505" ? new Error("A category with that name already exists") : error;
}

/** Deletes only the category; its photographs are untouched. */
export async function deleteCategory(id: string) {
  const { error } = await supabase.from("photo_categories").delete().eq("id", id);
  if (error) throw error;
}

/** Move every photo from `from` into `into`, then remove `from`. */
export async function mergeCategory(from: string, into: string, links: readonly CategoryLink[]) {
  const rows = links.filter((l) => l.category_id === from).map((l) => ({ photo_id: l.photo_id, category_id: into }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("photo_category_links").upsert(rows.slice(i, i + 500), { onConflict: "photo_id,category_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  await deleteCategory(from);
}

export async function saveCategoryOrder(ordered: readonly PhotoCategory[]) {
  await Promise.all(ordered.map((c, i) => supabase.from("photo_categories").update({ sort_order: i + 1 }).eq("id", c.id).then(({ error }) => { if (error) throw error; })));
}

export async function setCategory(photoIds: readonly string[], categoryId: string, on: boolean) {
  for (let i = 0; i < photoIds.length; i += 500) {
    const ids = photoIds.slice(i, i + 500);
    const { error } = on
      ? await supabase.from("photo_category_links").upsert(ids.map((photo_id) => ({ photo_id, category_id: categoryId })), { onConflict: "photo_id,category_id", ignoreDuplicates: true })
      : await supabase.from("photo_category_links").delete().eq("category_id", categoryId).in("photo_id", ids);
    if (error) throw error;
  }
}

export async function fetchBoxes(): Promise<PhotoBox[]> {
  const { data, error } = await supabase.from("photo_boxes").select("id, code, name, location").order("code");
  if (error) throw error;
  return data ?? [];
}

export async function createBox(input: { code: string; name?: string; location?: string }): Promise<PhotoBox> {
  const code = normalizeBoxCode(input.code);
  if (!code) throw new Error("Enter a box identifier");
  const { data, error } = await supabase
    .from("photo_boxes")
    .insert({ code, name: input.name?.trim() || null, location: input.location?.trim() || null })
    .select("id, code, name, location")
    .single();
  if (error) throw error.code === "23505" ? new Error(`${code} already exists`) : error;
  return data;
}

export async function updateBox(id: string, patch: { name: string; location: string }) {
  const { error } = await supabase.from("photo_boxes").update({ name: patch.name.trim() || null, location: patch.location.trim() || null }).eq("id", id);
  if (error) throw error;
}

/** Set (or clear, with null) the one physical box for these photographs; a photo placed directly in a box leaves its sleeve. */
export async function assignBox(photoIds: readonly string[], boxId: string | null) {
  for (let i = 0; i < photoIds.length; i += 500) {
    const { error } = await supabase.from("photos").update({ box_id: boxId, sleeve_id: null }).in("id", photoIds.slice(i, i + 500));
    if (error) throw error;
  }
}

export async function fetchBatches(): Promise<PhotoBatch[]> {
  const { data, error } = await supabase.from("photo_batches").select("id, name, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBatch(name: string): Promise<PhotoBatch> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("photo_batches").insert({ name: name.trim() || null, created_by: auth.user?.id ?? null }).select("id, name, created_at").single();
  if (error) throw error;
  return data;
}

export async function renameBatch(id: string, name: string) {
  const { error } = await supabase.from("photo_batches").update({ name: name.trim() || null }).eq("id", id);
  if (error) throw error;
}

export type PhotoDetails = {
  caption: string;
  people: string;
  date_text: string;
  location: string;
  inscription: string;
  notes: string;
  info_source: string;
  back_transcription: string;
};

/** Save the optional details. Text is stored as typed (inscriptions are never altered beyond nothing-vs-something). */
export async function savePhotoDetails(id: string, d: PhotoDetails) {
  const blank = (v: string) => (v.trim() ? v : null);
  const years = parsePhotoYears(d.date_text);
  const { error } = await supabase
    .from("photos")
    .update({
      caption: blank(d.caption)?.trim() ?? null,
      people: blank(d.people)?.trim() ?? null,
      date_text: blank(d.date_text)?.trim() ?? null,
      date_year_start: years?.start ?? null,
      date_year_end: years?.end ?? null,
      location: blank(d.location)?.trim() ?? null,
      inscription: blank(d.inscription),
      notes: blank(d.notes),
      info_source: blank(d.info_source)?.trim() ?? null,
      back_transcription: blank(d.back_transcription),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function numberingState() {
  const { data, error } = await supabase.from("photo_counter").select("last_seq, numbering_enabled").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data ?? { last_seq: 0, numbering_enabled: false };
}

export async function runPhNumbering(): Promise<number> {
  const { data, error } = await supabase.rpc("assign_ph_numbers");
  if (error) throw error;
  return data ?? 0;
}

export type PhotoSleeve = { id: string; code: string; name: string | null; box_id: string | null; created_at: string };

export async function fetchSleeves(): Promise<PhotoSleeve[]> {
  const { data, error } = await supabase.from("photo_sleeves").select("id, code, name, box_id, created_at").order("code");
  if (error) throw error;
  return data ?? [];
}

export async function createSleeve(input: { code: string; name?: string; boxId?: string | null }): Promise<PhotoSleeve> {
  const code = input.code.trim().toUpperCase().replace(/^SLEEVE[\s-]*(\d+)$/, (_, n: string) => "SLEEVE-" + n.padStart(3, "0"));
  if (!code) throw new Error("Enter a sleeve identifier");
  const { data, error } = await supabase.from("photo_sleeves")
    .insert({ code, name: input.name?.trim() || null, box_id: input.boxId ?? null })
    .select("id, code, name, box_id, created_at").single();
  if (error) throw error.code === "23505" ? new Error(`${code} already exists`) : error;
  return data;
}

export async function renameSleeve(id: string, name: string) {
  const { error } = await supabase.from("photo_sleeves").update({ name: name.trim() || null }).eq("id", id);
  if (error) throw error;
}

/** Deletes the sleeve only; its photographs stay in the same box, unsleeved. */
export async function deleteSleeve(id: string) {
  const { error } = await supabase.from("photo_sleeves").delete().eq("id", id);
  if (error) throw error;
}

/** Put photographs into a sleeve (they move to the sleeve's box), or take them out with null. */
export async function assignSleeve(photoIds: readonly string[], sleeveId: string | null) {
  for (let i = 0; i < photoIds.length; i += 500) {
    const { error } = await supabase.from("photos").update({ sleeve_id: sleeveId }).in("id", photoIds.slice(i, i + 500));
    if (error) throw error;
  }
}

/** Move whole sleeves into a box (or out of any box with null); their photographs follow. */
export async function moveSleeves(sleeveIds: readonly string[], boxId: string | null) {
  if (!sleeveIds.length) return;
  const { error } = await supabase.from("photo_sleeves").update({ box_id: boxId }).in("id", [...sleeveIds]);
  if (error) throw error;
}
