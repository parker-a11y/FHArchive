/**
 * Type-ahead suggestions for the "Date as written" field, drawn from the
 * date lines already used on other records (e.g. "Mon. eve — June 14").
 * Free text still wins — the list only suggests, it never restricts.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DATE_AS_WRITTEN_LIST_ID = "date-as-written-options";

/** Distinct Date-as-written values already used in the archive, alphabetical. */
export function useDateAsWrittenOptions() {
  return useQuery({
    queryKey: ["date-as-written-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letters")
        .select("date_as_written")
        .not("date_as_written", "is", null)
        .limit(5000);
      if (error) throw error;
      const seen = new Map<string, string>();
      for (const row of data ?? []) {
        const v = (row.date_as_written ?? "").trim();
        if (!v || v.toUpperCase() === "NONE") continue;
        if (!seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
      }
      return [...seen.values()].sort((a, b) => a.localeCompare(b));
    },
    staleTime: 60_000,
  });
}

/** Datalist that powers type-ahead matching on any Date-as-written input. */
export function DateAsWrittenDatalist() {
  const { data: options = [] } = useDateAsWrittenOptions();
  return (
    <datalist id={DATE_AS_WRITTEN_LIST_ID}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}
