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
  /** Include envelope scans among the record images. */
  includeEnvelope?: boolean;
  /** Ask Francis result, sent as its own block so it is never lost in the note. */
  research?: {
    question?: string | null;
    answer?: string | null;
    caveats?: string | null;
    confidence?: string | null;
    sources?: { title?: string | null; url: string }[];
  } | null;
  /** One small clickable thumbnail per record instead of full-width scans. */
  thumbnails?: boolean;
  /** ISO time to send later; omitted = send now. */
  scheduledFor?: string | null;
};

export type SendArchiveEmailResult = {
  emailId: string | null;
  sent: string[];
  suppressed: string[];
  failed: { email: string; error: string }[];
  scheduledFor?: string;
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
    includeEnvelope: Boolean(data.includeEnvelope),
    thumbnails: Boolean(data.thumbnails),
    scheduledFor: data.scheduledFor ? String(data.scheduledFor) : null,
    research: data.research?.answer
      ? {
          question: String(data.research.question ?? "").slice(0, 2000),
          answer: String(data.research.answer).slice(0, 40000),
          caveats: String(data.research.caveats ?? "").slice(0, 4000),
          confidence: String(data.research.confidence ?? "").slice(0, 40),
          sources: (data.research.sources ?? [])
            .slice(0, 15)
            .map((s) => ({ title: s.title ?? null, url: String(s.url) }))
            .filter((s) => /^https?:\/\//i.test(s.url)),
        }
      : null,
  }))
  .handler(async ({ data, context }): Promise<SendArchiveEmailResult> => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can send email.");
    if (data.recipients.length === 0) throw new Error("Add at least one valid email address.");
    if (!data.subject) throw new Error("A subject is required.");

    const { deliverArchiveEmail, scheduleArchiveEmail } = await import("@/lib/archive-email-send.server");
    const { scheduledFor, ...payload } = data;
    if (scheduledFor) {
      const when = new Date(scheduledFor);
      if (Number.isNaN(when.getTime())) throw new Error("That scheduled time is not valid.");
      if (when.getTime() < Date.now() + 60_000) throw new Error("Pick a time at least a minute from now.");
      const emailId = await scheduleArchiveEmail(db, context.userId, payload, when);
      return { emailId, sent: [], suppressed: [], failed: [], scheduledFor: when.toISOString() };
    }
    return deliverArchiveEmail(db, context.userId, payload);
  });

/** Cancels a scheduled (not yet sent) email. Admin only. */
export const cancelScheduledEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { emailId: string }) => ({ emailId: String(data.emailId) }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can cancel email.");
    const { error } = await db
      .from("archive_emails")
      .update({ status: "cancelled", send_payload: null } as never)
      .eq("id", data.emailId)
      .eq("status", "scheduled");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
