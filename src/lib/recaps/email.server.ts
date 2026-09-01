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

export async function sendRecapEmail(
  db: any,
  ownerId: string,
  weekStart: string,
  recipients: { email: string; name?: string | null }[],
  message: string,
  options: { publicLinks?: boolean; includeTranscription?: boolean } = {},
): Promise<RecapEmailResult> {
  const { data: recap } = await db
    .from("weekly_recaps")
    .select(
      "id, week_start, week_end, title, lede, body_md, related_ids, image_bucket, image_path, image_caption, stats",
    )
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!recap) throw new Error("That recap could not be found.");

  const weekRange = formatWeekRange(recap.week_start, recap.week_end);

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

  // Unlisted share links so recipients without an archive account can open records.
  const relatedIds: string[] = (recap.related_ids ?? []).slice(0, 40);
  let shareLinks: Record<string, string> = {};
  if (options.publicLinks !== false) {
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

  const templateData = {
    subject: `Francis Files Weekly Recap — ${weekRange}`,
    weekRange,
    title: recap.title,
    lede: recap.lede,
    body: recap.body_md,
    message: message || null,
    imageUrl,
    imageCaption: recap.image_caption,
    relatedIds,
    shareLinks,
    stats,
    recapUrl: `${SITE_URL}/recaps/${recap.week_start}`,
  };

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
