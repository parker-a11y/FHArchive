/**
 * Postal service / postage classification for correspondence records.
 *
 * Built-in options live here; archivists can add more (stored per-owner in
 * `record_categories` with kind = "postal_service") without a redesign.
 *
 * Airmail is a *specific form* of paid postage: a record marked "airmail"
 * automatically qualifies as paid/stamped mail for searching and analysis,
 * while a search for airmail alone returns only airmail records.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeLabel, slugify, type Option } from "@/lib/categories";

export const POSTAL_SERVICES: readonly Option[] = [
  { value: "free_military", label: "FREE — Military Free Mail" },
  { value: "paid", label: "Stamped / Paid Postage" },
  { value: "airmail", label: "Airmail" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
] as const;

/** Values that count as paid/stamped postage (airmail included). */
export const PAID_POSTAL_SERVICES = ["paid", "airmail"] as const;

export function isPaidPostage(value: string | null | undefined) {
  return !!value && (PAID_POSTAL_SERVICES as readonly string[]).includes(value);
}

export function postalServiceLabel(value: string | null | undefined, extra: Option[] = []) {
  if (!value) return "—";
  return (
    [...POSTAL_SERVICES, ...extra].find((o) => o.value === value)?.label ?? value
  );
}

export function usePostalServiceOptions(): Option[] {
  const { data = [] } = useQuery({
    queryKey: ["postal-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("record_categories")
        .select("value, label")
        .eq("kind", "postal_service")
        .order("label");
      if (error) throw error;
      return (data ?? []) as Option[];
    },
    staleTime: 10 * 60_000,
  });
  const seen = new Set(POSTAL_SERVICES.map((o) => o.value));
  return [...POSTAL_SERVICES, ...data.filter((o) => !seen.has(o.value))];
}

export async function addPostalService(label: string, existing: Option[]) {
  const clean = normalizeLabel(label);
  if (!clean) throw new Error("Enter a name first");
  const dup = existing.find((o) => o.label.toLowerCase() === clean.toLowerCase());
  if (dup) return dup.value;
  const value = slugify(clean);
  const { error } = await supabase
    .from("record_categories")
    .insert({ kind: "postal_service", value, label: clean } as never);
  if (error) throw new Error(error.message);
  return value;
}
