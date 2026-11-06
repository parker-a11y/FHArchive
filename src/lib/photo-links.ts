import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PhotoRecordRef } from "@/lib/photo-archive";

export type LinkType = "letter" | "photo" | "person";
export type Certainty = "documented" | "recollection" | "tentative";
export const CERTAINTY_LABEL: Record<Certainty, string> = {
  documented: "Documented",
  recollection: "Family recollection",
  tentative: "Tentative",
};

export type PhotoLink = {
  id: string; photo_id: string; target_type: LinkType; target_id: string;
  certainty: Certainty; note: string | null;
  label: string; code: string | null; href: string;
  /** True when this photo is the link's target (photo-to-photo links work both ways). */
  reverse?: boolean;
};

export type LinkCandidate = { type: LinkType; id: string; label: string; code: string | null };

type Row = { id: string; photo_id: string; target_type: string; target_id: string; certainty: string; note: string | null };

/** Links touching one photo, labelled with the linked letter/photo/person. Photo links are shown from either side. */
export async function fetchPhotoLinks(photoId: string): Promise<PhotoLink[]> {
  const [{ data: out, error: e1 }, { data: inc, error: e2 }] = await Promise.all([
    supabase.from("photo_links").select("id,photo_id,target_type,target_id,certainty,note").eq("photo_id", photoId),
    supabase.from("photo_links").select("id,photo_id,target_type,target_id,certainty,note").eq("target_type", "photo").eq("target_id", photoId),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  const rows: (Row & { reverse?: boolean })[] = [...(out ?? []), ...(inc ?? []).map((r) => ({ ...r, reverse: true }))];
  const ids = (t: LinkType) => [...new Set(rows.filter((r) => (r.reverse ? "photo" : r.target_type) === t).map((r) => (r.reverse ? r.photo_id : r.target_id)))];
  const [letters, photos, people] = await Promise.all([
    ids("letter").length ? supabase.from("letters").select("id,archive_id,title").in("id", ids("letter")) : { data: [] },
    ids("photo").length ? supabase.from("photos").select("id,ph_id,caption").in("id", ids("photo")) : { data: [] },
    ids("person").length ? supabase.from("people").select("id,name").in("id", ids("person")) : { data: [] },
  ]);
  const L = new Map((letters.data ?? []).map((x: any) => [x.id, x]));
  const P = new Map((photos.data ?? []).map((x: any) => [x.id, x]));
  const N = new Map((people.data ?? []).map((x: any) => [x.id, x]));
  return rows.map((r) => {
    const type = (r.reverse ? "photo" : r.target_type) as LinkType;
    const tid = r.reverse ? r.photo_id : r.target_id;
    let label = "Unknown"; let code: string | null = null; let href = "#";
    if (type === "letter") { const x: any = L.get(tid); code = x?.archive_id ?? null; label = x?.title || code || "Letter"; href = `/letters/${code ?? ""}`; }
    if (type === "photo") { const x: any = P.get(tid); code = x?.ph_id ?? null; label = x?.caption || code || "Photograph"; href = `/photos/${code ?? ""}`; }
    if (type === "person") { const x: any = N.get(tid); label = x?.name ?? "Person"; href = `/people/${tid}`; }
    return { id: r.id, photo_id: r.photo_id, target_type: type, target_id: tid, certainty: r.certainty as Certainty, note: r.note, label, code, href, reverse: r.reverse };
  });
}

export async function searchLinkCandidates(type: LinkType, q: string, excludePhotoId: string): Promise<LinkCandidate[]> {
  const term = q.trim().replace(/[%,()]/g, " ");
  if (!term) return [];
  if (type === "letter") {
    const { data } = await supabase.from("letters").select("id,archive_id,title").neq("record_type", "moved_to_gallery")
      .or(`archive_id.ilike.%${term}%,title.ilike.%${term}%`).order("fh_seq").limit(12);
    return (data ?? []).map((x: any) => ({ type, id: x.id, label: x.title || x.archive_id, code: x.archive_id }));
  }
  if (type === "photo") {
    const { data } = await supabase.from("photos").select("id,ph_id,caption").neq("id", excludePhotoId)
      .or(`ph_id.ilike.%${term}%,caption.ilike.%${term}%`).limit(12);
    return (data ?? []).map((x: any) => ({ type, id: x.id, label: x.caption || x.ph_id || "Photograph", code: x.ph_id }));
  }
  const { data } = await supabase.from("people").select("id,name").ilike("name", `%${term}%`).order("name").limit(12);
  return (data ?? []).map((x: any) => ({ type, id: x.id, label: x.name, code: null }));
}

export async function addPhotoLink(photoId: string, c: LinkCandidate, certainty: Certainty, note: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("photo_links").insert({
    photo_id: photoId, target_type: c.type, target_id: c.id, certainty, note: note.trim() || null, created_by: u.user?.id ?? null,
  });
  if (error) throw error.code === "23505" ? new Error("Already linked") : error;
}

export async function updatePhotoLink(id: string, certainty: Certainty) {
  const { error } = await supabase.from("photo_links").update({ certainty }).eq("id", id);
  if (error) throw error;
}

export async function removePhotoLink(id: string) {
  const { error } = await supabase.from("photo_links").delete().eq("id", id);
  if (error) throw error;
}

const CERTAINTY_RANK: Record<string, number> = { documented: 0, recollection: 1, tentative: 2 };

/** For every photograph, the archive record to open: its connected letter, best certainty first. */
export async function fetchPhotoRecords(): Promise<Map<string, PhotoRecordRef>> {
  const { data: rows, error } = await supabase.from("photo_links")
    .select("photo_id,target_id,certainty").eq("target_type", "letter");
  if (error) throw error;
  const ids = [...new Set((rows ?? []).map((r) => r.target_id))];
  let letters: { id: string; archive_id: string | null; title: string | null }[] = [];
  if (ids.length) {
    const { data, error: e2 } = await supabase.from("letters").select("id,archive_id,title").in("id", ids);
    if (e2) throw e2;
    letters = (data ?? []) as typeof letters;
  }
  const byId = new Map(letters.map((x) => [x.id, x]));
  const best = new Map<string, { rank: number; rec: PhotoRecordRef }>();
  for (const r of rows ?? []) {
    const x = byId.get(r.target_id);
    if (!x?.archive_id) continue;
    const rank = CERTAINTY_RANK[r.certainty] ?? 9;
    const cur = best.get(r.photo_id);
    if (cur && cur.rank <= rank) continue;
    best.set(r.photo_id, {
      rank,
      rec: { archive_id: x.archive_id, title: x.title, href: `/letters/${x.archive_id}`, via: "linked" },
    });
  }
  return new Map([...best].map(([photoId, v]) => [photoId, v.rec]));
}

/** Shared across the organizer tools so the record button appears without re-querying per photo. */
export function usePhotoRecords() {
  return useQuery({ queryKey: ["photo-records"], queryFn: fetchPhotoRecords, staleTime: 60_000 });
}
