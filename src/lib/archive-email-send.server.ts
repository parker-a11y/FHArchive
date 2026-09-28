import type { SendArchiveEmailResult } from "./archive-email.functions";

/** Validated send input (output of sendArchiveEmail's validator). */
export type ArchiveEmailPayload = {
  recipients: { email: string; name: string | null }[];
  subject: string;
  headerTitle: string;
  headerSubtitle: string;
  message: string;
  records: { kind: "letter" | "source"; id: string }[];
  includeTranscription: boolean;
  includeImages: boolean;
  includeEnvelope: boolean;
  thumbnails: boolean;
  research: {
    question: string;
    answer: string;
    caveats: string;
    confidence: string;
    sources: { title: string | null; url: string }[];
  } | null;
};

function messageBody(data: ArchiveEmailPayload) {
  return (
    [
      data.message,
      data.research?.question ? `Research question: ${data.research.question}` : "",
      data.research?.answer ?? "",
    ]
      .filter(Boolean)
      .join("\n\n") || null
  );
}

/** Stores an email to be sent later by the scheduled-emails job. */
export async function scheduleArchiveEmail(
  db: any,
  userId: string,
  data: ArchiveEmailPayload,
  when: Date,
) {
  const { data: row, error } = await db
    .from("archive_emails")
    .insert({
      owner_id: userId,
      subject: data.subject,
      message_body: messageBody(data),
      header_title: data.headerTitle || null,
      header_subtitle: data.headerSubtitle || null,
      recipients: data.recipients,
      attachment_count: 0,
      status: "scheduled",
      scheduled_for: when.toISOString(),
      send_payload: data,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (row as { id?: string } | null)?.id ?? null;
}

/** Renders and sends an archive email; reuses `existingId` for scheduled rows. */
export async function deliverArchiveEmail(
  db: any,
  userId: string,
  data: ArchiveEmailPayload,
  existingId?: string,
): Promise<SendArchiveEmailResult> {
  const { buildRecords, rememberContacts, ensureShareLinksForRefs, resolveInlinePhotos } =
    await import("@/lib/archive-email.server");
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  const records = await buildRecords(db, userId, data.records, {
    includeTranscription: data.includeTranscription,
    includeImages: data.includeImages,
    includeEnvelope: data.includeEnvelope,
  });

  const linkableText = [data.message, data.research?.answer ?? "", data.research?.question ?? ""].join("\n");
  const mentionedRefs = linkableText.match(/(FH|DS)-?\d{3,}/gi) ?? [];
  const shareLinks =
    mentionedRefs.length > 0
      ? await ensureShareLinksForRefs(db, userId, mentionedRefs, data.includeTranscription)
      : {};
  const inlinePhotos = await resolveInlinePhotos(db, userId, linkableText, {
    includeTranscription: data.includeTranscription,
  });

  let emailId: string | null = existingId ?? null;
  if (emailId) {
    await db
      .from("archive_emails")
      .update({ status: "sending", sent_at: new Date().toISOString() })
      .eq("id", emailId);
  } else {
    const { data: logRow } = await db
      .from("archive_emails")
      .insert({
        owner_id: userId,
        subject: data.subject,
        message_body: messageBody(data),
        header_title: data.headerTitle || null,
        header_subtitle: data.headerSubtitle || null,
        recipients: data.recipients,
        attachment_count: 0,
        status: "sending",
      })
      .select("id")
      .maybeSingle();
    emailId = (logRow as { id?: string } | null)?.id ?? null;
  }

  if (emailId) {
    for (const [i, r] of records.entries()) {
      if (r.kind !== "letter") continue;
      await db.from("archive_email_records").insert({
        owner_id: userId,
        email_id: emailId,
        letter_id: r.id,
        archive_id: r.identifier,
        sort_order: i,
      });
    }
  }

  const result: SendArchiveEmailResult = { emailId, sent: [], suppressed: [], failed: [] };

  for (const recipient of data.recipients) {
    try {
      const res = await sendTemplateEmail("archive-record", recipient.email, {
        idempotencyKey: `archive-email-${emailId ?? crypto.randomUUID()}-${recipient.email}`,
        templateData: {
          subject: data.subject,
          headerTitle: data.headerTitle || data.subject,
          headerSubtitle: data.headerSubtitle || undefined,
          message: data.message || undefined,
          research: data.research ?? undefined,
          thumbnails: data.thumbnails,
          shareLinks,
          inlinePhotos,
          senderName: "The Francis Files",
          records: records.map((r) => ({
            identifier: r.identifier,
            title: r.title,
            date: r.date,
            details: r.details,
            summary: r.summary,
            transcription: r.transcription,
            url: r.url,
            images: r.images,
            fff: r.fff,
          })),
        },
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
        send_payload: null,
        error: result.failed.length ? result.failed.map((f) => `${f.email}: ${f.error}`).join("; ") : null,
      })
      .eq("id", emailId);
  }

  await rememberContacts(db, userId, data.recipients);
  return result;
}
