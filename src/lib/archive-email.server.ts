import type { SupabaseClient } from "@supabase/supabase-js";

/** Emailed links always point at the public archive domain, never a preview URL. */
export const PUBLIC_SITE_URL = "https://fharchive.com";

export type EmailRecordRef = { kind: "letter" | "source"; id: string };

export type BuiltRecord = {
  kind: "letter" | "source";
  id: string;
  identifier: string;
  title: string | null;
  date: string | null;
  details: string[];
  summary: string | null;
  transcription: string | null;
  url: string;
  images: string[];
  fff: boolean;
};

type DB = SupabaseClient<any, "public", any>;

function token() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const str = (v: unknown) => (v == null || v === "" ? null : String(v));

/** Reuses an enabled record-scope share when one exists, otherwise mints one. */
async function ensureLetterShare(
  db: DB,
  ownerId: string,
  letterId: string,
  includeTranscription: boolean,
) {
  const { data: existing } = await db
    .from("record_shares")
    .select("*")
    .eq("letter_id", letterId)
    .eq("scope", "record")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (existing) return existing['token'] as string;

  const t = token();
  const { error } = await db.from("record_shares").insert({
    owner_id: ownerId,
    letter_id: letterId,
    scope: "record",
    token: t,
    include_transcription: includeTranscription,
    include_notes: false,
  } as never);
  if (error) throw new Error(`Could not create a share link: ${error.message}`);
  await db.from("letters").update({ visibility: "shared" } as never).eq("id", letterId);
  return t;
}

async function ensureSourceShare(
  db: DB,
  ownerId: string,
  sourceId: string,
  includeTranscript: boolean,
) {
  const { data: existing } = await db
    .from("source_shares")
    .select("*")
    .eq("source_id", sourceId)
    .eq("scope", "record")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (existing) return existing['token'] as string;

  const t = token();
  const { error } = await db.from("source_shares").insert({
    owner_id: ownerId,
    source_id: sourceId,
    scope: "record",
    token: t,
    include_transcript: includeTranscript,
    include_notes: false,
  } as never);
  if (error) throw new Error(`Could not create a share link: ${error.message}`);
  await db.from("digital_sources").update({ visibility: "shared" } as never).eq("id", sourceId);
  return t;
}

async function letterImages(db: DB, letterId: string, limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const [{ data: files }, { data: derivatives }] = await Promise.all([
    db
      .from("digital_files")
      .select("id, master_path, master_mime, sort_order")
      .eq("letter_id", letterId)
      .order("sort_order", { ascending: true }),
    db.from("file_derivatives").select("file_id, kind, status, storage_path").eq("letter_id", letterId),
  ]);
  const urls: string[] = [];
  for (const f of (files ?? []).slice(0, limit)) {
    const own = (derivatives ?? []).filter((d: any) => d.file_id === (f as any).id);
    const jpeg = own.find((d: any) => d.kind === "jpeg" && d.status === "complete");
    const viewable = /^image\/(jpeg|png|webp|gif)$/i.test(String((f as any).master_mime ?? ""));
    const path = jpeg?.storage_path ?? (viewable ? (f as any).master_path : null);
    if (!path) continue;
    // Long-lived signed URL so the image still renders in the mailbox later.
    const { data } = await db.storage.from("scans").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}

async function sourceImages(db: DB, sourceId: string, limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const { data: files } = await db
    .from("ds_files")
    .select("storage_path, mime_type, sort_order")
    .eq("source_id", sourceId)
    .order("sort_order", { ascending: true });
  const urls: string[] = [];
  for (const f of files ?? []) {
    if (!/^image\//i.test(String((f as any).mime_type ?? ""))) continue;
    const { data } = await db.storage
      .from("ds-files")
      .createSignedUrl(String((f as any).storage_path), 60 * 60 * 24 * 365);
    if (data?.signedUrl) urls.push(data.signedUrl);
    if (urls.length >= limit) break;
  }
  return urls;
}

export async function buildRecords(
  db: DB,
  ownerId: string,
  refs: EmailRecordRef[],
  opts: { includeTranscription: boolean; includeImages: boolean },
): Promise<BuiltRecord[]> {
  const out: BuiltRecord[] = [];
  const imageLimit = opts.includeImages ? 4 : 0;

  for (const ref of refs) {
    if (ref.kind === "letter") {
      const { data: l } = await db.from("letters").select("*").eq("id", ref.id).maybeSingle();
      if (!l) continue;
      const row = l as Record<string, unknown>;
      const t = await ensureLetterShare(db, ownerId, ref.id, opts.includeTranscription);
      const details = [
        str(row['author']) ? `From ${row['author']}` : null,
        str(row['recipient']) ? `To ${row['recipient']}` : null,
        str(row['origin']),
        str(row['primary_person']),
      ].filter((v): v is string => Boolean(v));
      out.push({
        kind: "letter",
        id: ref.id,
        identifier: String(row['archive_id']),
        title: str(row['title']),
        date: str(row['date_as_written']) ?? str(row['normalized_date']),
        details,
        summary: str(row['summary_short']) ?? str(row['summary_long']),
        transcription: opts.includeTranscription
          ? (str(row['transcription_verified']) ?? str(row['transcription_raw_ai']))?.slice(0, 8000) ??
            null
          : null,
        fff: Boolean(row['starred']),
        url: `${PUBLIC_SITE_URL}/s/${t}`,
        images: await letterImages(db, ref.id, imageLimit),
      });
    } else {
      const { data: s } = await db.from("digital_sources").select("*").eq("id", ref.id).maybeSingle();
      if (!s) continue;
      const row = s as Record<string, unknown>;
      const t = await ensureSourceShare(db, ownerId, ref.id, opts.includeTranscription);
      const details = [
        str(row['creator']),
        str(row['institution']),
        str(row['source_type']),
      ].filter((v): v is string => Boolean(v));
      out.push({
        kind: "source",
        id: ref.id,
        identifier: String(row['ds_id']),
        title: str(row['title']),
        date: str(row['original_date']) ?? str(row['normalized_date']),
        details,
        summary: str(row['description']),
        transcription: opts.includeTranscription
          ? (str(row['transcript']) ?? null)?.slice(0, 8000) ?? null
          : null,
        fff: Boolean(row['starred']),
        url: `${PUBLIC_SITE_URL}/d/${t}`,
        images: await sourceImages(db, ref.id, imageLimit),
      });
    }
  }
  return out;
}

export async function rememberContacts(
  db: DB,
  ownerId: string,
  recipients: { email: string; name?: string | null }[],
) {
  const now = new Date().toISOString();
  for (const r of recipients) {
    const { data: existing } = await db
      .from("archive_contacts")
      .select("id")
      .eq("email", r.email)
      .limit(1)
      .maybeSingle();
    if (existing) {
      await db
        .from("archive_contacts")
        .update({ last_used_at: now, ...(r.name ? { name: r.name } : {}) } as never)
        .eq("id", (existing as any).id);
    } else {
      await db.from("archive_contacts").insert({
        owner_id: ownerId,
        email: r.email,
        name: r.name || r.email,
        last_used_at: now,
      } as never);
    }
  }
}

/**
 * Turns FH / DS record numbers into public share URLs, minting an unlisted
 * link when one does not already exist. Used by the weekly recap email so
 * recipients without an archive account can still open the records.
 */
export async function ensureShareLinksForRefs(
  db: DB,
  ownerId: string,
  refs: string[],
  includeTranscription: boolean,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(refs.map((r) => r.toUpperCase())));
  const letterRefs = unique.filter((r) => r.startsWith("FH"));
  const sourceRefs = unique.filter((r) => r.startsWith("DS"));
  const map: Record<string, string> = {};

  if (letterRefs.length) {
    const { data } = await db
      .from("letters")
      .select("id, archive_id")
      .in("archive_id", letterRefs);
    for (const row of (data ?? []) as any[]) {
      try {
        const t = await ensureLetterShare(db, ownerId, row.id, includeTranscription);
        map[String(row.archive_id).toUpperCase()] = `${PUBLIC_SITE_URL}/s/${t}`;
      } catch {
        /* a single unshareable record must never block the email */
      }
    }
  }

  if (sourceRefs.length) {
    const { data } = await db.from("digital_sources").select("id, ds_id").in("ds_id", sourceRefs);
    for (const row of (data ?? []) as any[]) {
      try {
        const t = await ensureSourceShare(db, ownerId, row.id, includeTranscription);
        map[String(row.ds_id).toUpperCase()] = `${PUBLIC_SITE_URL}/d/${t}`;
      } catch {
        /* ignore */
      }
    }
  }

  return map;
}
