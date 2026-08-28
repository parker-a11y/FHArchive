import { createServerFn } from "@tanstack/react-start";

export type SharedPage = {
  id: string;
  label: string;
  url: string;
  thumbUrl: string;
  rotation: number;
};

export type SharedRecord = {
  scope: "record" | "file";
  archiveId: string;
  title: string | null;
  recordType: string;
  subtype: string | null;
  dateAsWritten: string | null;
  normalizedDate: string | null;
  dateEnd: string | null;
  datePrecision: string | null;
  dateCertainty: string | null;
  period: string | null;
  author: string | null;
  recipient: string | null;
  origin: string | null;
  destination: string | null;
  primaryPerson: string | null;
  physicalDescription: string | null;
  summary: string | null;
  transcription: string | null;
  notes: string | null;
  publicNote: string | null;
  people: string[];
  places: string[];
  keywords: string[];
  organizations: string[];
  events: string[];
  pages: SharedPage[];
  itemLabel: string | null;
};

/**
 * Public, unauthenticated read of one shared record or one shared page.
 * Only whitelisted fields leave the server, and only web derivatives
 * (never archival master TIFFs) are given short-lived signed URLs.
 */
export const getSharedRecord = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data.token).slice(0, 64) }))
  .handler(async ({ data }): Promise<SharedRecord | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: share } = await supabaseAdmin
      .from("record_shares")
      .select("*")
      .eq("token", data.token)
      .eq("enabled", true)
      .maybeSingle();
    if (!share) return null;

    const { data: letter } = await supabaseAdmin
      .from("letters")
      .select("*")
      .eq("id", share.letter_id)
      .maybeSingle();
    if (!letter) return null;

    const l = letter as Record<string, unknown>;
    const str = (k: string) => (l[k] == null ? null : String(l[k]));

    const [people, places, keywords, orgs, events, filesRes, derRes] = await Promise.all([
      supabaseAdmin.from("letter_people").select("people(name)").eq("letter_id", share.letter_id),
      supabaseAdmin
        .from("letter_places")
        .select("places(canonical_name)")
        .eq("letter_id", share.letter_id),
      supabaseAdmin
        .from("letter_keywords")
        .select("keywords(name)")
        .eq("letter_id", share.letter_id),
      supabaseAdmin
        .from("letter_organizations")
        .select("organizations(name)")
        .eq("letter_id", share.letter_id),
      supabaseAdmin.from("letter_events").select("events(name)").eq("letter_id", share.letter_id),
      supabaseAdmin
        .from("digital_files")
        .select("*")
        .eq("letter_id", share.letter_id)
        .order("sort_order", { ascending: true }),
      supabaseAdmin.from("file_derivatives").select("*").eq("letter_id", share.letter_id),
    ]);

    const names = (rows: unknown, key: string, sub: string) =>
      ((rows as { data?: unknown[] } | null)?.data ?? []).length === 0
        ? []
        : ([] as string[]);
    void names;

    const pick = (res: { data: unknown[] | null }, rel: string, field: string): string[] =>
      (res.data ?? [])
        .map((r) => {
          const v = (r as Record<string, unknown>)[rel] as Record<string, unknown> | null;
          return v ? (v[field] as string) : null;
        })
        .filter((v): v is string => Boolean(v));

    const derivatives = (derRes.data ?? []) as Record<string, unknown>[];
    let files = (filesRes.data ?? []) as Record<string, unknown>[];
    if (share.scope === "file" && share.file_id) {
      files = files.filter((f) => f['id'] === share.file_id);
    }

    const pages: SharedPage[] = [];
    for (const f of files) {
      const own = derivatives.filter((d) => d['file_id'] === f['id']);
      const jpeg = own.find((d) => d['kind'] === "jpeg" && d['status'] === "complete");
      const thumb = own.find((d) => d['kind'] === "thumbnail" && d['status'] === "complete");
      const browserViewable = /^image\/(jpeg|png|webp|gif)$/i.test(String(f['master_mime'] ?? ""));
      // Archival masters (TIFF and friends) are never exposed publicly.
      const viewPath =
        (jpeg?.['storage_path'] as string | undefined) ??
        (browserViewable ? (f['master_path'] as string) : null);
      if (!viewPath) continue;
      const thumbPath = (thumb?.['storage_path'] as string | undefined) ?? viewPath;
      const [v, t] = await Promise.all([
        supabaseAdmin.storage.from("scans").createSignedUrl(viewPath, 3600),
        supabaseAdmin.storage.from("scans").createSignedUrl(thumbPath, 3600),
      ]);
      if (!v.data?.signedUrl) continue;
      pages.push({
        id: String(f['id']),
        label: (f['label'] as string) || (f['seq'] ? `Page ${f['seq']}` : `Image ${pages.length + 1}`),
        url: v.data.signedUrl,
        thumbUrl: t.data?.signedUrl ?? v.data.signedUrl,
        rotation: Number(f['rotation'] ?? 0),
      });
    }

    // Legacy item scans (already web-format JPEGs).
    if (share.scope === "record") {
      const { data: scans } = await supabaseAdmin
        .from("letter_scans")
        .select("*")
        .eq("letter_id", share.letter_id)
        .order("sort_order", { ascending: true });
      for (const s of (scans ?? []) as Record<string, unknown>[]) {
        const signed = await supabaseAdmin.storage
          .from("scans")
          .createSignedUrl(String(s['storage_path']), 3600);
        if (!signed.data?.signedUrl) continue;
        pages.push({
          id: String(s['id']),
          label: String(s['file_label'] ?? "Scan"),
          url: signed.data.signedUrl,
          thumbUrl: signed.data.signedUrl,
          rotation: Number(s['rotation'] ?? 0),
        });
      }
    }

    void supabaseAdmin
      .from("record_shares")
      .update({
        view_count: (share.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      } as never)
      .eq("id", share.id);

    return {
      scope: share.scope as "record" | "file",
      archiveId: String(l['archive_id']),
      title: str("title"),
      recordType: String(l['record_type'] ?? ""),
      subtype: str("subtype"),
      dateAsWritten: str("date_as_written"),
      normalizedDate: str("normalized_date"),
      dateEnd: str("date_end"),
      datePrecision: str("date_precision"),
      dateCertainty: str("date_certainty"),
      period: str("period"),
      author: str("author"),
      recipient: str("recipient"),
      origin: str("origin"),
      destination: str("destination"),
      primaryPerson: str("primary_person"),
      physicalDescription: str("physical_description"),
      summary: str("summary_long") ?? str("summary_short"),
      transcription: share.include_transcription
        ? str("transcription_verified") ?? str("transcription_raw_ai")
        : null,
      notes: share.include_notes ? str("historical_notes") ?? str("notes") : null,
      publicNote: (share.public_note as string | null) ?? null,
      people: pick(people as { data: unknown[] | null }, "people", "name"),
      places: pick(places as { data: unknown[] | null }, "places", "canonical_name"),
      keywords: pick(keywords as { data: unknown[] | null }, "keywords", "name"),
      organizations: pick(orgs as { data: unknown[] | null }, "organizations", "name"),
      events: pick(events as { data: unknown[] | null }, "events", "name"),
      pages,
      itemLabel: share.scope === "file" ? (pages[0]?.label ?? null) : null,
    };
  });
