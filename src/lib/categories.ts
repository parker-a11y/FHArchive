/**
 * User-extensible record types and subtypes.
 *
 * Built-in categories live in `src/lib/archive.ts`; anything the archivist adds
 * is stored per-owner in `record_categories` and merged into the pickers. New
 * subtypes belong to the record type that was selected when they were created.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RECORD_TYPES, subtypesFor } from "@/lib/archive";

export type Category = {
  id: string;
  kind: "record_type" | "subtype";
  value: string;
  label: string;
  parent_type: string | null;
};

export type Option = { value: string; label: string };

/** "Song Lyrics " → "song_lyrics" — stable machine value for a record type. */
export function slugify(label: string) {
  return (
    label
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || `custom_${Date.now()}`
  );
}

export function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, " ");
}

function sameLabel(a: string, b: string) {
  return normalizeLabel(a).toLowerCase() === normalizeLabel(b).toLowerCase();
}

export function useCategories() {
  return useQuery({
    queryKey: ["record-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("record_categories")
        .select("id, kind, value, label, parent_type")
        .order("label");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    staleTime: 10 * 60_000,
  });
}

export function useInvalidateCategories() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["record-categories"] });
}

/** Built-in record types followed by the archivist's own. */
export function useRecordTypeOptions(): Option[] {
  const { data = [] } = useCategories();
  const custom = data
    .filter((c) => c.kind === "record_type")
    .map((c) => ({ value: c.value, label: c.label }));
  const seen = new Set<string>(RECORD_TYPES.map((r) => r.value as string));
  return [
    ...RECORD_TYPES.map((r) => ({ value: r.value, label: r.label })),
    ...custom.filter((c) => !seen.has(c.value)),
  ];
}

export function useSubtypeOptions(recordType: string): string[] {
  const { data = [] } = useCategories();
  const builtIn = subtypesFor(recordType);
  const custom = data
    .filter((c) => c.kind === "subtype" && c.parent_type === recordType)
    .map((c) => c.label);
  return [...builtIn, ...custom.filter((l) => !builtIn.some((b) => sameLabel(b, l)))];
}

export async function addRecordType(label: string, existing: Option[]) {
  const clean = normalizeLabel(label);
  if (!clean) throw new Error("Enter a name first");
  const dup = existing.find((o) => sameLabel(o.label, clean));
  if (dup) return dup.value;
  const value = slugify(clean);
  const { error } = await supabase
    .from("record_categories")
    .insert({ kind: "record_type", value, label: clean } as never);
  if (error) throw new Error(error.message);
  return value;
}

export async function addSubtype(recordType: string, label: string, existing: string[]) {
  const clean = normalizeLabel(label);
  if (!clean) throw new Error("Enter a name first");
  const dup = existing.find((l) => sameLabel(l, clean));
  if (dup) return dup;
  const { error } = await supabase
    .from("record_categories")
    .insert({ kind: "subtype", value: slugify(clean), label: clean, parent_type: recordType } as never);
  if (error) throw new Error(error.message);
  return clean;
}

export async function renameCategory(id: string, label: string) {
  const clean = normalizeLabel(label);
  if (!clean) throw new Error("Enter a name first");
  const { error } = await supabase
    .from("record_categories")
    .update({ label: clean } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("record_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
