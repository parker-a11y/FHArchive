import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SendArchiveEmailInput = {
  recipients: { email: string; name?: string | null }[];
  subject: string;
  headerTitle?: string;
  headerSubtitle?: string;
  message?: string;
  records: { kind: "letter" | "source"; id: string }[];
  includeTranscription?: boolean;
  includeImages?: boolean;
};

export type SendArchiveEmailResult = {
  emailId: string | null;
  sent: string[];
  suppressed: string[];
  failed: { email: string; error: string }[];
};

/**
 * Sends one archive email to one or more recipients. Admin only. Scans travel
 * as unlisted share links (attachments are not supported by managed sending).
 */
export const sendArchiveEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SendArchiveEmailInput) => ({
    recipients: (data.recipients ?? [])
      .slice(0, 25)
      .map((r) => ({ email: String(r.email).trim().toLowerCase(), name: r.name ?? null }))
      .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)),
    subject: String(data.subject ?? "").slice(0, 200),
    headerTitle: String(data.headerTitle ?? "").slice(0, 200),
    headerSubtitle: String(data.headerSubtitle ?? "").slice(0, 200),
    message: String(data.message ?? "").slice(0, 10000),
    records: (data.records ?? [])
      .slice(0, 10)
      .map((r) => ({ kind: r.kind === "source" ? ("source" as const) : ("letter" as const), id: String(r.id) })),
    includeTranscription: Boolean(data.includeTranscription),
    includeImages: data.includeImages !== false,
  }))
  .handler(async ({ data, context }): Promise<SendArchiveEmailResult> => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can send email.");
    if (data.recipients.length === 0) throw new Error("Add at least one valid email address.");
    if (!data.subject) throw new Error("A subject is required.");

    const { buildRecords, rememberContacts } = await import("@/lib/archive-email.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    const records = await buildRecords(db as never, context.userId, data.records, {
      includeTranscription: data.includeTranscription,
      includeImages: data.includeImages,
    });

    const { data: logRow } = await db
      .from("archive_emails")
      .insert({
        owner_id: context.userId,
        subject: data.subject,
        message_body: data.message || null,
        header_title: data.headerTitle || null,
        header_subtitle: data.headerSubtitle || null,
        recipients: data.recipients,
        attachment_count: 0,
        status: "sending",
      } as never)
      .select("id")
      .maybeSingle();
    const emailId = (logRow as { id?: string } | null)?.id ?? null;

    if (emailId) {
      for (const [i, r] of records.entries()) {
        if (r.kind !== "letter") continue;
        await db.from("archive_email_records").insert({
          owner_id: context.userId,
          email_id: emailId,
          letter_id: r.id,
          archive_id: r.identifier,
          sort_order: i,
        } as never);
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
            senderName: "the Harrington Family Archive",
            records: records.map((r) => ({
              identifier: r.identifier,
              title: r.title,
              date: r.date,
              details: r.details,
              summary: r.summary,
              transcription: r.transcription,
              url: r.url,
              images: r.images,
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
          error: result.failed.length ? result.failed.map((f) => `${f.email}: ${f.error}`).join("; ") : null,
        } as never)
        .eq("id", emailId);
    }

    await rememberContacts(db as never, context.userId, data.recipients);

    return result;
  });
