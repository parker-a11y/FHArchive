import { supabase } from "@/integrations/supabase/client";

/** Seed tone / sentiment categories. Custom ones live in `tone_options`. */
export const DEFAULT_TONES = [
  "Humor / Playfulness",
  "Happiness / Joy",
  "Hope / Optimism",
  "Love / Affection",
  "Longing / Sadness / Homesickness",
  "Anxiety / Worry",
  "Anger / Frustration",
  "Discouragement / Despair",
  "Loneliness / Isolation",
  "Boredom / Restlessness",
  "Pride / Accomplishment",
  "Gratitude / Appreciation",
  "Concern for Others",
  "Reflective / Contemplative",
  "Matter-of-Fact / Neutral",
] as const;

export type ToneOption = { id: string; name: string };

export async function fetchToneOptions(): Promise<ToneOption[]> {
  const { data, error } = await supabase.from("tone_options").select("id,name").order("name");
  if (error) throw error;
  return (data ?? []) as ToneOption[];
}

export async function createToneOption(name: string): Promise<void> {
  const { error } = await supabase.from("tone_options").insert({ name } as never);
  // Ignore duplicates — the option already exists and can simply be selected.
  if (error && !/duplicate key/i.test(error.message)) throw error;
}

/** Merge seed tones, saved custom tones and any values already on a record. */
export function mergeToneOptions(custom: ToneOption[], selected: string[] = []): string[] {
  const set = new Set<string>(DEFAULT_TONES);
  for (const c of custom) if (c.name) set.add(c.name);
  for (const s of selected) if (s) set.add(s);
  return Array.from(set);
}

/** Correspondence subtypes that get automatic tone / sentiment suggestions. */
export const TONE_SUBTYPES = [
  "Personal letter",
  "Circular / Group letter",
  "Postcard",
  "Telegram",
  "Greeting card",
];

/** True when a record should be offered AI tone suggestions. */
export function toneEligible(recordType?: string | null, subtype?: string | null) {
  return recordType === "letter" && TONE_SUBTYPES.includes(subtype ?? "");
}
