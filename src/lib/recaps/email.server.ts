/** Server-only: builds and sends a Weekly Recap email. Never called automatically. */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { sendTemplateEmail } from "@/lib/email-templates/send-email";

const SITE_URL = "https://fharchive.com";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (s: string, withYear: boolean) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      ...(withYear ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    });
  const sameYear = weekStart.slice(0, 4) === weekEnd.slice(0, 4);
  return `${fmt(weekStart, !sameYear)} – ${fmt(weekEnd, true)}`;
}

const STAT_LABELS: Record<string, string> = {
  records: "records added",
  letters: "records added",
  sources: "digital sources added",
  scans: "scans uploaded",
  files: "files uploaded",
  transcriptions: "transcriptions completed",
  people: "people added",
  places: "places added",
  quotations: "quotations captured",
};

export type RecapEmailResult = {
  sent: string[];
  suppressed: string[];
  failed: { email: string; error: string }[];
};

const RECAP_COLUMNS =
  "id, kind, slug, range_label, week_start, week_end, title, lede, body_md, related_ids, image_bucket, image_path, image_caption, stats, owner_id, share_token";

/** Builds the weekly-recap template data for a recap row — shared by email and the public link page. */
export async function buildRecapTemplateData(
  db: any,
  recap: any,
  options: { publicLinks?: boolean; includeTranscription?: boolean } = {},
) {
  // Older recaps were stored without an owner; fall back to the archive owner so
  // record links can still be minted.
  let ownerId = (recap.owner_id as string | null) ?? null;
  if (!ownerId) {
    const { data: anyLetter } = await db
      .from("letters")
      .select("owner_id")
      .not("owner_id", "is", null)
      .limit(1)
      .maybeSingle();
    ownerId = (anyLetter as { owner_id?: string } | null)?.owner_id ?? null;
  }
  const weekRange = recap.range_label || formatWeekRange(recap.week_start, recap.week_end);

  let imageUrl: string | null = null;
  if (recap.image_path) {
    const { data: signed } = await db.storage
      .from(recap.image_bucket || "scans")
      .createSignedUrl(recap.image_path, 60 * 60 * 24 * 30);
    imageUrl = signed?.signedUrl ?? null;
  }

  const stats = Object.entries((recap.stats ?? {}) as Record<string, number>)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .slice(0, 6)
    .map(([k, v]) => ({ label: STAT_LABELS[k] ?? k.replace(/_/g, " "), value: v }));

  // Unlisted share links so viewers without an archive account can open records.
  const relatedIds: string[] = (recap.related_ids ?? []).slice(0, 40);
  let shareLinks: Record<string, string> = {};
  if (options.publicLinks !== false && ownerId) {
    const inBody: string[] = (String(recap.body_md ?? "").match(/\b(?:FH-?\d{3,}|DS-?\d{3,})\b/g) ??
      []) as string[];
    const { ensureShareLinksForRefs } = await import("@/lib/archive-email.server");
    shareLinks = await ensureShareLinksForRefs(
      db,
      ownerId,
      [...relatedIds, ...inBody],
      options.includeTranscription === true,
    );
  }

  // Photos embedded in the recap body travel inline.
  let inlinePhotos: Record<string, unknown> = {};
  if (ownerId) {
    const { resolveInlinePhotos } = await import("@/lib/archive-email.server");
    inlinePhotos = await resolveInlinePhotos(db, ownerId, `${recap.body_md ?? ""}`, {
      includeTranscription: options.includeTranscription === true,
    });
  }

  return {
    subject:
      recap.kind === "weekly"
        ? `Francis Files Weekly Recap — ${weekRange}`
        : recap.kind === "blog"
          ? `From the Archivist's Desk — ${recap.title}`
          : `The Francis Files — ${recap.title}`,
    kind: String(recap.kind ?? "weekly"),
    weekRange,
    title: recap.title,
    lede: recap.lede,
    body: recap.body_md,
    message: null as string | null,
    imageUrl,
    imageCaption: recap.image_caption,
    relatedIds,
    shareLinks,
    inlinePhotos,
    stats,
    recapUrl: `${SITE_URL}/recaps/${recap.slug || recap.week_start}`,
  };
}

/** Renders a recap as standalone HTML using the Weekly Recap template. */
export async function renderRecapHtml(
  db: any,
  recap: any,
  options: { publicLinks?: boolean; includeTranscription?: boolean } = {},
): Promise<string> {
  const templateData = await buildRecapTemplateData(db, recap, options);
  const [{ render }, { template }, React] = await Promise.all([
    import("@react-email/render"),
    import("@/lib/email-templates/weekly-recap"),
    import("react"),
  ]);
  const element = React.createElement(template.component, templateData as never);
  return await render(element as never);
}

/** Loads a recap by its public share token. */
export async function recapByShareToken(db: any, token: string) {
  const { data } = await db
    .from("weekly_recaps")
    .select(RECAP_COLUMNS)
    .eq("share_token", token)
    .maybeSingle();
  return data;
}

export async function sendRecapEmail(
  db: any,
  ownerId: string,
  weekStart: string,
  recipients: { email: string; name?: string | null }[],
  message: string,
  options: { publicLinks?: boolean; includeTranscription?: boolean } = {},
): Promise<RecapEmailResult> {
  const isWeek = /^\d{4}-\d{2}-\d{2}$/.test(weekStart);
  let query = db.from("weekly_recaps").select(RECAP_COLUMNS);
  query = isWeek ? query.eq("week_start", weekStart).eq("kind", "weekly") : query.eq("slug", weekStart);
  const { data: recap } = await query.maybeSingle();

  if (!recap) throw new Error("That recap could not be found.");

  const weekRange = recap.range_label || formatWeekRange(recap.week_start, recap.week_end);

  const templateData = await buildRecapTemplateData(db, recap, options);
  templateData.message = message || null;
  if (message) {
    // Photos embedded in the personal note travel inline too.
    const { resolveInlinePhotos } = await import("@/lib/archive-email.server");
    templateData.inlinePhotos = await resolveInlinePhotos(
      db,
      ownerId,
      `${recap.body_md ?? ""}\n${message}`,
      { includeTranscription: options.includeTranscription === true },
    );
  }




  const result: RecapEmailResult = { sent: [], suppressed: [], failed: [] };

  const { data: logRow } = await db
    .from("archive_emails")
    .insert({
      owner_id: ownerId,
      subject: templateData.subject,
      message_body: message || null,
      header_title: recap.title,
      header_subtitle: `Weekly Recap — ${weekRange}`,
      recipients,
      attachment_count: 0,
      status: "sending",
    } as never)
    .select("id")
    .maybeSingle();
  const emailId = (logRow as { id?: string } | null)?.id ?? null;

  for (const recipient of recipients) {
    try {
      const res = await sendTemplateEmail("weekly-recap", recipient.email, {
        idempotencyKey: `weekly-recap-${recap.id}-${emailId ?? "x"}-${recipient.email}`,
        templateData,
      });
      if (res.sent) result.sent.push(recipient.email);
      else result.suppressed.push(recipient.email);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      result.failed.push({
        email: recipient.email,
        error:
          err.code === "domain_not_verified"
            ? "Sender domain is still verifying — try again once DNS finishes."
            : err.message || "Send failed",
      });
    }
  }

  if (emailId) {
    const status =
      result.failed.length === 0
        ? result.sent.length > 0
          ? "sent"
          : "suppressed"
        : result.sent.length > 0
          ? "partial"
          : "failed";
    await db
      .from("archive_emails")
      .update({
        status,
        error: result.failed.length
          ? result.failed.map((f) => `${f.email}: ${f.error}`).join("; ")
          : null,
      } as never)
      .eq("id", emailId);
  }

  const { rememberContacts } = await import("@/lib/archive-email.server");
  await rememberContacts(db, ownerId, recipients);

  return result;
}
