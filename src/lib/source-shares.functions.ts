import { createServerFn } from "@tanstack/react-start";

export type SharedSourceFile = {
  id: string;
  label: string;
  fileType: string;
  mimeType: string | null;
  url: string;
};

export type SharedSource = {
  scope: "record" | "file";
  dsId: string;
  title: string;
  sourceType: string;
  creator: string | null;
  institution: string | null;
  originalDate: string | null;
  normalizedDate: string | null;
  historicalDateRange: string | null;
  dateAccessed: string | null;
  url: string | null;
  description: string | null;
  citation: string | null;
  rightsNotes: string | null;
  transcript: string | null;
  notes: string | null;
  publicNote: string | null;
  people: string[];
  places: string[];
  keywords: string[];
  organizations: string[];
  events: string[];
  files: SharedSourceFile[];
  itemLabel: string | null;
};

/**
 * Public, unauthenticated read of one shared digital source or one shared file.
 * Only whitelisted fields leave the server and files get short-lived signed URLs.
 */
export const getSharedSource = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data.token).slice(0, 64) }))
  .handler(async ({ data }): Promise<SharedSource | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: share } = await supabaseAdmin
      .from("source_shares")
      .select("*")
      .eq("token", data.token)
      .eq("enabled", true)
      .maybeSingle();
    if (!share) return null;

    const { data: source } = await supabaseAdmin
      .from("digital_sources")
      .select("*")
      .eq("id", share.source_id)
      .maybeSingle();
    if (!source) return null;

    const s = source as Record<string, unknown>;
    const str = (k: string) => (s[k] == null ? null : String(s[k]));

    const [people, places, keywords, orgs, events, filesRes] = await Promise.all([
      supabaseAdmin.from("ds_people").select("people(name)").eq("source_id", share.source_id),
      supabaseAdmin
        .from("ds_places")
        .select("places(canonical_name)")
        .eq("source_id", share.source_id),
      supabaseAdmin.from("ds_keywords").select("keywords(name)").eq("source_id", share.source_id),
      supabaseAdmin
        .from("ds_organizations")
        .select("organizations(name)")
        .eq("source_id", share.source_id),
      supabaseAdmin.from("ds_events").select("events(name)").eq("source_id", share.source_id),
      supabaseAdmin
        .from("ds_files")
        .select("*")
        .eq("source_id", share.source_id)
        .order("sort_order", { ascending: true }),
    ]);

    const pick = (res: { data: unknown[] | null }, rel: string, field: string): string[] =>
      (res.data ?? [])
        .map((r) => {
          const v = (r as Record<string, unknown>)[rel] as Record<string, unknown> | null;
          return v ? (v[field] as string) : null;
        })
        .filter((v): v is string => Boolean(v));

    let rows = (filesRes.data ?? []) as Record<string, unknown>[];
    if (share.scope === "file" && share.file_id) {
      rows = rows.filter((f) => f['id'] === share.file_id);
    }

    const files: SharedSourceFile[] = [];
    for (const f of rows) {
      const signed = await supabaseAdmin.storage
        .from("ds-files")
        .createSignedUrl(String(f['storage_path']), 3600);
      if (!signed.data?.signedUrl) continue;
      files.push({
        id: String(f['id']),
        label: String(f['file_label'] ?? f['original_filename'] ?? "File"),
        fileType: String(f['file_type'] ?? "other"),
        mimeType: (f['mime_type'] as string | null) ?? null,
        url: signed.data.signedUrl,
      });
    }

    void supabaseAdmin
      .from("source_shares")
      .update({
        view_count: (share.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      } as never)
      .eq("id", share.id);

    return {
      scope: share.scope as "record" | "file",
      dsId: String(s['ds_id']),
      title: String(s['title'] ?? ""),
      sourceType: String(s['source_type'] ?? ""),
      creator: str("creator"),
      institution: str("institution"),
      originalDate: str("original_date"),
      normalizedDate: str("normalized_date"),
      historicalDateRange: str("historical_date_range"),
      dateAccessed: str("date_accessed"),
      url: str("url"),
      description: str("description"),
      citation: str("citation"),
      rightsNotes: str("rights_notes"),
      transcript: share.include_transcript ? str("transcript") : null,
      notes: share.include_notes ? str("notes") : null,
      publicNote: (share.public_note as string | null) ?? null,
      people: pick(people as { data: unknown[] | null }, "people", "name"),
      places: pick(places as { data: unknown[] | null }, "places", "canonical_name"),
      keywords: pick(keywords as { data: unknown[] | null }, "keywords", "name"),
      organizations: pick(orgs as { data: unknown[] | null }, "organizations", "name"),
      events: pick(events as { data: unknown[] | null }, "events", "name"),
      files,
      itemLabel: share.scope === "file" ? (files[0]?.label ?? null) : null,
    };
  });
