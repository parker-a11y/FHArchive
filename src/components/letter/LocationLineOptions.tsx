/**
 * Shared helpers for the Location Line field: type-ahead suggestions drawn from
 * places already written on other records, plus a NONE quick pick so a blank
 * field can be told apart from one that was checked and had nothing written.
 */

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const LOCATION_LINE_LIST_ID = "location-line-options";
export const LOCATION_LINE_NONE = "NONE";

/** Distinct Location Line values already used in the archive, alphabetical. */
export function useLocationLineOptions() {
  return useQuery({
    queryKey: ["location-line-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letters")
        .select("dateline")
        .not("dateline", "is", null)
        .limit(5000);
      if (error) throw error;
      const seen = new Map<string, string>();
      for (const row of data ?? []) {
        const v = (row.dateline ?? "").trim();
        if (!v || v.toUpperCase() === LOCATION_LINE_NONE) continue;
        if (!seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
      }
      return [...seen.values()].sort((a, b) => a.localeCompare(b));
    },
    staleTime: 60_000,
  });
}

/** Datalist that powers type-ahead matching on any Location Line input. */
export function LocationLineDatalist() {
  const { data: options = [] } = useLocationLineOptions();
  return (
    <datalist id={LOCATION_LINE_LIST_ID}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}

/** NONE quick pick — records that the letter was checked and had no place written. */
export function LocationLineNoneButton({ onPick }: { onPick: (value: string) => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      onClick={() => onPick(LOCATION_LINE_NONE)}
    >
      NONE
    </Button>
  );
}
