import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { membershipRows, type RecordKey, type CollectionRecord } from "./model";
export async function fetchCollections() {
  const { data, error } = await supabase.from("collections").select("*").order("name");
  if (error) throw error;
  const memberships = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: part, error: e } = await supabase
      .from("collection_memberships")
      .select("id,collection_id,kind,ref_id")
      .order("id")
      .range(offset, offset + 999);
    if (e) throw e;
    memberships.push(...(part ?? []));
    if ((part?.length ?? 0) < 1000) break;
  }
  return { collections: data ?? [], memberships };
}
export const collectionsQuery = queryOptions({
  queryKey: ["collections"],
  queryFn: fetchCollections,
});
export async function createCollection(name: string, description = "") {
  const { data, error } = await supabase
    .from("collections")
    .insert({ name: name.trim(), description })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function applyCollections(
  collectionIds: string[],
  records: RecordKey[],
  remove = false,
) {
  if (!collectionIds.length || !records.length) return;
  if (remove) {
    for (const kind of ["letter", "photo", "source"] as const) {
      const ids = [...new Set(records.filter((r) => r.kind === kind).map((r) => r.id))];
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase
          .from("collection_memberships")
          .delete()
          .in("collection_id", collectionIds)
          .eq("kind", kind)
          .in("ref_id", ids.slice(i, i + 200));
        if (error) throw error;
      }
    }
  } else {
    const rows = membershipRows(collectionIds, records);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from("collection_memberships")
        .upsert(rows.slice(i, i + 500), {
          onConflict: "collection_id,kind,ref_id",
          ignoreDuplicates: true,
        });
      if (error) throw error;
    }
  }
}
const fields =
  "kind,ref_id,identifier,title,record_type,sort_date,date_text,author,recipient,origin,destination" as const;
export async function fetchCollectionRecords(collectionId: string): Promise<CollectionRecord[]> {
  const { memberships } = await fetchCollections();
  const members = memberships.filter((m) => m.collection_id === collectionId);
  const result: CollectionRecord[] = [];
  for (const kind of ["letter", "photo", "source"] as const) {
    const ids = members.filter((m) => m.kind === kind).map((m) => m.ref_id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase
        .from("collection_archive_records")
        .select(fields)
        .eq("kind", kind)
        .in("ref_id", ids.slice(i, i + 200));
      if (error) throw error;
      for (const r of data ?? [])
        if (r.ref_id && r.identifier)
          result.push({ ...r, kind, ref_id: r.ref_id, identifier: r.identifier });
    }
  }
  return result;
}
export async function fetchRecordOptions(q: string): Promise<CollectionRecord[]> {
  let query = supabase
    .from("collection_archive_records")
    .select(fields)
    .order("identifier")
    .limit(100);
  const term = q.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
  if (term)
    query = query.or(
      `identifier.ilike.%${term}%,title.ilike.%${term}%,author.ilike.%${term}%,recipient.ilike.%${term}%`,
    );
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).filter(
    (r) => r.ref_id && r.identifier && ["letter", "photo", "source"].includes(r.kind ?? ""),
  ) as CollectionRecord[];
}
export async function searchCollectionText(collectionId: string, term: string): Promise<string[]> {
  const { memberships } = await fetchCollections();
  const members = memberships.filter((m) => m.collection_id === collectionId);
  const matches: string[] = [];
  const q = term.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
  if (!q) return [];
  for (const kind of ["letter", "photo", "source"] as const) {
    const ids = members.filter((m) => m.kind === kind).map((m) => m.ref_id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase
        .from("collection_archive_records")
        .select("ref_id")
        .eq("kind", kind)
        .in("ref_id", ids.slice(i, i + 200))
        .ilike("body", `%${q}%`);
      if (error) throw error;
      matches.push(...(data ?? []).map((r) => `${kind}:${r.ref_id}`));
    }
  }
  return matches;
}
