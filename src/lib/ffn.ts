/**
 * Francis File Notes — the archive's reusable knowledge layer.
 *
 * A note is created once (YMS -> Yard Minesweeper) and recognised everywhere.
 * Recognition happens purely in the display layer: stored transcriptions are
 * never rewritten, so the source text stays historically faithful.
 */
import { supabase } from "@/integrations/supabase/client";
import { searchLetters } from "@/lib/queries";

export type FfnStatus = "draft" | "published";

export type FfnNote = {
  id: string;
  term: string;
  title: string | null;
  expanded_name: string | null;
  slug: string;
  category: string;
  short_definition: string | null;
  background: string | null;
  archive_context: string | null;
  sources: string | null;
  status: FfnStatus;
  auto_link: boolean;
  appearance_count: number;
  appearances_updated_at: string | null;
  ai_assisted: boolean;
  ai_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FfnAlias = {
  id: string;
  note_id: string;
  alias: string;
  alias_norm: string;
  auto_link: boolean;
};

export type FfnImage = {
  id: string;
  note_id: string;
  image_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  caption: string | null;
  credit: string | null;
  rights_note: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type FfnOccurrence = {
  id: string;
  note_id: string;
  kind: string;
  ref_id: string | null;
  ref_label: string | null;
  excerpt: string | null;
  state: string;
  created_at: string;
};

export const FFN_CATEGORIES = [
  "person",
  "place",
  "ship",
  "ship_type",
  "military_term",
  "navy_term",
  "rank",
  "organization",
  "equipment",
  "aircraft",
  "vehicle",
  "operation",
  "historical_event",
  "cultural_reference",
  "slang",
  "media",
  "everyday_life",
  "other",
] as const;

export const categoryLabel = (value: string) =>
  value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const table = (name: string) => supabase.from(name as "letters") as any;

/** Lowercase, punctuation-stripped form used for alias comparison. */
export function normAlias(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "note"
  );
}

export const noteTitle = (n: Pick<FfnNote, "term" | "title">) => n.title?.trim() || n.term;

/* ---------------------------------------------------------------- reading */

export async function fetchNotes(opts: { includeDrafts?: boolean } = {}): Promise<FfnNote[]> {
  let q = table("ffn_notes").select("*").order("term");
  if (!opts.includeDrafts) q = q.eq("status", "published");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as FfnNote[];
}

export async function fetchNote(idOrSlug: string): Promise<FfnNote | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data } = await table("ffn_notes")
    .select("*")
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .maybeSingle();
  return (data ?? null) as FfnNote | null;
}

export async function fetchAliases(noteId: string): Promise<FfnAlias[]> {
  const { data } = await table("ffn_aliases").select("*").eq("note_id", noteId).order("alias");
  return (data ?? []) as FfnAlias[];
}

export async function fetchAllAliases(): Promise<FfnAlias[]> {
  const { data } = await table("ffn_aliases").select("*");
  return (data ?? []) as FfnAlias[];
}

export async function fetchImages(noteId: string): Promise<FfnImage[]> {
  const { data } = await table("ffn_images")
    .select("*")
    .eq("note_id", noteId)
    .order("is_primary", { ascending: false })
    .order("sort_order");
  return (data ?? []) as FfnImage[];
}

export async function fetchOccurrences(noteId: string): Promise<FfnOccurrence[]> {
  const { data } = await table("ffn_occurrences")
    .select("*")
    .eq("note_id", noteId)
    .neq("state", "ignored")
    .order("ref_label");
  return (data ?? []) as FfnOccurrence[];
}

export async function fetchRelatedNotes(noteId: string): Promise<FfnNote[]> {
  const { data } = await table("ffn_relations").select("a_id,b_id").or(`a_id.eq.${noteId},b_id.eq.${noteId}`);
  const ids = (data ?? [])
    .map((r: { a_id: string; b_id: string }) => (r.a_id === noteId ? r.b_id : r.a_id))
    .filter(Boolean);
  if (!ids.length) return [];
  const { data: notes } = await table("ffn_notes").select("*").in("id", ids).order("term");
  return (notes ?? []) as FfnNote[];
}

/* -------------------------------------------------- the auto-link index */

export type AliasEntry = { alias: string; noteId: string };

/**
 * Every alias eligible for automatic recognition: published notes with
 * auto-linking on, longest alias first so "Yard Minesweeper" wins over "YMS".
 */
export async function fetchAliasIndex(): Promise<{
  entries: AliasEntry[];
  notes: Record<string, FfnNote>;
}> {
  const { data: notes } = await table("ffn_notes")
    .select("*")
    .eq("status", "published")
    .eq("auto_link", true);
  const list = (notes ?? []) as FfnNote[];
  if (!list.length) return { entries: [], notes: {} };
  const byId: Record<string, FfnNote> = {};
  for (const n of list) byId[n.id] = n;
  const { data: aliases } = await table("ffn_aliases")
    .select("note_id,alias,auto_link")
    .in("note_id", Object.keys(byId))
    .eq("auto_link", true);
  const entries: AliasEntry[] = [];
  for (const n of list) entries.push({ alias: n.term, noteId: n.id });
  for (const a of (aliases ?? []) as { note_id: string; alias: string }[])
    entries.push({ alias: a.alias, noteId: a.note_id });
  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    const key = `${e.noteId}::${normAlias(e.alias)}`;
    if (!e.alias.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => b.alias.length - a.alias.length);
  return { entries: unique, notes: byId };
}

/* ---------------------------------------------------------------- writing */

export async function createNote(input: Partial<FfnNote> & { term: string }): Promise<FfnNote> {
  const slug = input.slug?.trim() || slugify(input.term);
  const { data, error } = await table("ffn_notes")
    .insert({ ...input, slug })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as FfnNote;
}

export async function updateNote(id: string, patch: Partial<FfnNote>) {
  const { error } = await table("ffn_notes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteNote(id: string) {
  const { error } = await table("ffn_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addAlias(noteId: string, alias: string, autoLink = true) {
  const clean = alias.trim();
  if (!clean) return;
  const { error } = await table("ffn_aliases").insert({
    note_id: noteId,
    alias: clean,
    alias_norm: normAlias(clean),
    auto_link: autoLink,
  });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

export async function setAliasAutoLink(id: string, autoLink: boolean) {
  const { error } = await table("ffn_aliases").update({ auto_link: autoLink }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeAlias(id: string) {
  const { error } = await table("ffn_aliases").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addImage(noteId: string, image: Partial<FfnImage>) {
  const { error } = await table("ffn_images").insert({ note_id: noteId, ...image });
  if (error) throw new Error(error.message);
}

export async function removeImage(id: string) {
  const { error } = await table("ffn_images").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function linkNotes(aId: string, bId: string) {
  const [a, b] = aId < bId ? [aId, bId] : [bId, aId];
  const { error } = await table("ffn_relations").insert({ a_id: a, b_id: b });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

export async function unlinkNotes(aId: string, bId: string) {
  const [a, b] = aId < bId ? [aId, bId] : [bId, aId];
  await table("ffn_relations").delete().eq("a_id", a).eq("b_id", b);
}

/* ------------------------------------------------- duplicate prevention */

/** Notes whose term, title, expanded name or an alias matches `term`. */
export async function findSimilarNotes(term: string): Promise<FfnNote[]> {
  const key = normAlias(term);
  if (!key) return [];
  const all = await fetchNotes({ includeDrafts: true });
  const aliases = await fetchAllAliases();
  const aliasHits = new Set(
    aliases.filter((a) => a.alias_norm === key).map((a) => a.note_id),
  );
  return all.filter(
    (n) =>
      aliasHits.has(n.id) ||
      normAlias(n.term) === key ||
      normAlias(n.title ?? "") === key ||
      normAlias(n.expanded_name ?? "") === key,
  );
}

/* ------------------------------------------------- archive appearances */

export type ArchiveMatch = {
  letter_id: string;
  archive_id: string;
  label: string;
  excerpt: string | null;
};

/** Records whose text contains any of the note's terms. */
export async function findArchiveMatches(terms: string[]): Promise<ArchiveMatch[]> {
  const out = new Map<string, ArchiveMatch>();
  for (const term of terms.filter((t) => t.trim())) {
    const { rows } = await searchLetters({ q: term, limit: 200 });
    for (const l of rows) {
      if (out.has(l.id)) continue;
      const text =
        l.transcription_verified || l.transcription_raw_ai || l.summary_short || l.notes || "";
      out.set(l.id, {
        letter_id: l.id,
        archive_id: l.archive_id,
        label: `${l.archive_id}${l.title ? ` — ${l.title}` : ""}`,
        excerpt: excerptAround(text, term),
      });
    }
  }
  return [...out.values()].sort((a, b) => a.archive_id.localeCompare(b.archive_id));
}

function excerptAround(text: string, term: string): string | null {
  const flat = text.replace(/\s+/g, " ").trim();
  const i = flat.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return flat ? flat.slice(0, 140) + (flat.length > 140 ? "…" : "") : null;
  const start = Math.max(0, i - 60);
  const end = Math.min(flat.length, i + term.length + 90);
  return (start > 0 ? "…" : "") + flat.slice(start, end).trim() + (end < flat.length ? "…" : "");
}

/** Replaces the note's automatically-found appearances, keeping manual tags. */
export async function saveArchiveMatches(noteId: string, matches: ArchiveMatch[]) {
  await table("ffn_occurrences").delete().eq("note_id", noteId).eq("state", "auto");
  if (matches.length) {
    const { error } = await table("ffn_occurrences").insert(
      matches.map((m) => ({
        note_id: noteId,
        kind: "letter",
        ref_id: m.letter_id,
        ref_label: m.label,
        excerpt: m.excerpt,
        state: "auto",
      })),
    );
    if (error) throw new Error(error.message);
  }
  const { count } = await (table("ffn_occurrences") as any)
    .select("id", { count: "exact", head: true })
    .eq("note_id", noteId)
    .neq("state", "ignored");
  await updateNote(noteId, {
    appearance_count: count ?? matches.length,
    appearances_updated_at: new Date().toISOString(),
  });
}

/** Attach one specific occurrence to a note (explicit admin tagging). */
export async function tagOccurrence(input: {
  noteId: string;
  letterId: string;
  label: string;
  excerpt?: string;
}) {
  const { error } = await table("ffn_occurrences").insert({
    note_id: input.noteId,
    kind: "letter",
    ref_id: input.letterId,
    ref_label: input.label,
    excerpt: input.excerpt ?? null,
    state: "tagged",
  });
  if (error) throw new Error(error.message);
}

export async function setOccurrenceState(id: string, state: "auto" | "tagged" | "ignored") {
  const { error } = await table("ffn_occurrences").update({ state }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ----------------------------------------------------------------- merge */

/** Folds `sourceId` into `targetId`, keeping aliases, images, tags and links. */
export async function mergeNotes(targetId: string, sourceId: string) {
  if (targetId === sourceId) return;
  const source = await fetchNote(sourceId);
  if (!source) return;
  const aliases = await fetchAliases(sourceId);
  for (const a of aliases) await addAlias(targetId, a.alias, a.auto_link);
  await addAlias(targetId, source.term, false);
  if (source.slug) await addAlias(targetId, source.slug.replace(/-/g, " "), false);
  await table("ffn_images").update({ note_id: targetId }).eq("note_id", sourceId);
  await table("ffn_occurrences").update({ note_id: targetId }).eq("note_id", sourceId);
  await table("ffn_entity_links").update({ note_id: targetId }).eq("note_id", sourceId);
  const related = await fetchRelatedNotes(sourceId);
  for (const r of related) if (r.id !== targetId) await linkNotes(targetId, r.id);
  await deleteNote(sourceId);
}
