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
  /** Draft being sent; the draft row is removed once the send is queued/delivered. */
  draftId?: string | null;
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
    message: String(data.message ?? "").slice(0, 100000),
    records: (data.records ?? [])
      .slice(0, 10)
      .map((r) => ({ kind: r.kind === "source" ? ("source" as const) : ("letter" as const), id: String(r.id) })),
    includeTranscription: Boolean(data.includeTranscription),
    includeImages: data.includeImages !== false,
    includeEnvelope: Boolean(data.includeEnvelope),
    thumbnails: Boolean(data.thumbnails),
    scheduledFor: data.scheduledFor ? String(data.scheduledFor) : null,
    draftId: data.draftId ? String(data.draftId) : null,
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

export type SaveEmailDraftInput = {
  /** Existing draft to overwrite; omitted = create a new draft. */
  draftId?: string | null;
  subject?: string;
  headerSubtitle?: string;
  message?: string;
  recipients?: { email: string; name?: string | null }[];
  records?: { kind: "letter" | "source"; id: string }[];
  includeTranscription?: boolean;
  includeImages?: boolean;
  includeEnvelope?: boolean;
  thumbnails?: boolean;
  research?: SendArchiveEmailInput["research"];
};

/** Saves an in-progress email as a draft (status "draft" — never sent by the scheduler). Admin only. */
export const saveEmailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SaveEmailDraftInput) => ({
    draftId: data.draftId ? String(data.draftId) : null,
    subject: String(data.subject ?? "").slice(0, 200),
    headerSubtitle: String(data.headerSubtitle ?? "").slice(0, 200),
    message: String(data.message ?? "").slice(0, 100000),
    recipients: (data.recipients ?? [])
      .slice(0, 25)
      .map((r) => ({ email: String(r.email).trim().toLowerCase(), name: r.name ?? null }))
      .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)),
    records: (data.records ?? [])
      .slice(0, 10)
      .map((r) => ({ kind: r.kind === "source" ? ("source" as const) : ("letter" as const), id: String(r.id) })),
    includeTranscription: Boolean(data.includeTranscription),
    includeImages: data.includeImages !== false,
    includeEnvelope: Boolean(data.includeEnvelope),
    thumbnails: Boolean(data.thumbnails),
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
  .handler(async ({ data, context }): Promise<{ draftId: string }> => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can save drafts.");

    const { draftId, subject, headerSubtitle, message, ...rest } = data;
    const payload = {
      subject,
      headerTitle: subject,
      headerSubtitle,
      message,
      ...rest,
      scheduledFor: null,
    };
    const row = {
      owner_id: context.userId,
      subject: subject || "(untitled draft)",
      message_body: message || null,
      header_title: subject || null,
      header_subtitle: headerSubtitle || null,
      recipients: data.recipients,
      status: "draft",
      scheduled_for: null,
      send_payload: payload,
    };
    if (draftId) {
      const { error } = await db
        .from("archive_emails")
        .update(row as never)
        .eq("id", draftId)
        .eq("status", "draft");
      if (error) throw new Error(error.message);
      return { draftId };
    }
    const { data: inserted, error } = await db
      .from("archive_emails")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { draftId: (inserted as { id: string }).id };
  });

/** Deletes a saved draft. Admin only. */
export const deleteEmailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { emailId: string }) => ({ emailId: String(data.emailId) }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can delete drafts.");
    const { error } = await db
      .from("archive_emails")
      .delete()
      .eq("id", data.emailId)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
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

/** Adds recipients to a scheduled (not yet sent) email. Admin only. */
export const addScheduledRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { emailId: string; recipients: { email: string; name?: string | null }[] }) => ({
    emailId: String(data.emailId),
    recipients: (data.recipients ?? [])
      .slice(0, 25)
      .map((r) => ({ email: String(r.email).trim().toLowerCase(), name: r.name ?? null }))
      .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)),
  }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can change email.");
    if (data.recipients.length === 0) throw new Error("Add at least one valid email address.");

    const { data: row, error: readError } = await db
      .from("archive_emails")
      .select("recipients, send_payload, status")
      .eq("id", data.emailId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row || (row as { status?: string }).status !== "scheduled")
      throw new Error("That email is no longer waiting to be sent.");

    const current = ((row as unknown as { recipients?: { email: string; name?: string | null }[] }).recipients ?? []);
    const merged = [...current];
    for (const r of data.recipients) {
      if (!merged.some((m) => m.email === r.email)) merged.push(r);
    }
    const payload = (row as unknown as { send_payload?: Record<string, unknown> | null }).send_payload ?? null;
    const nextPayload = payload ? { ...payload, recipients: merged } : payload;

    const { error } = await db
      .from("archive_emails")
      .update({ recipients: merged, send_payload: nextPayload } as never)
      .eq("id", data.emailId)
      .eq("status", "scheduled");
    if (error) throw new Error(error.message);
    return { recipients: merged };
  });

/** Edits a scheduled (not yet sent) email: subject, note, recipients and send time. Admin only. */
export const updateScheduledEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      emailId: string;
      subject: string;
      message: string;
      scheduledFor: string;
      recipients: { email: string; name?: string | null }[];
    }) => ({
      emailId: String(data.emailId),
      subject: String(data.subject ?? "").trim().slice(0, 200),
      message: String(data.message ?? "").slice(0, 100000),
      scheduledFor: String(data.scheduledFor ?? ""),
      recipients: (data.recipients ?? [])
        .slice(0, 25)
        .map((r) => ({ email: String(r.email).trim().toLowerCase(), name: r.name ?? null }))
        .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can change email.");
    if (!data.subject) throw new Error("A subject is required.");
    if (data.recipients.length === 0) throw new Error("Add at least one valid email address.");
    const when = new Date(data.scheduledFor);
    if (Number.isNaN(when.getTime())) throw new Error("That scheduled time is not valid.");
    if (when.getTime() < Date.now() + 60_000) throw new Error("Pick a time at least a minute from now.");

    const { data: row, error: readError } = await db
      .from("archive_emails")
      .select("send_payload, status")
      .eq("id", data.emailId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row || (row as { status?: string }).status !== "scheduled")
      throw new Error("That email is no longer waiting to be sent.");
    const payload = ((row as unknown as { send_payload?: Record<string, unknown> | null }).send_payload ?? {}) as Record<string, unknown>;
    const oldSubject = String(payload["subject"] ?? "");
    const nextPayload = {
      ...payload,
      subject: data.subject,
      headerTitle: !payload["headerTitle"] || payload["headerTitle"] === oldSubject ? data.subject : payload["headerTitle"],
      message: data.message,
      recipients: data.recipients,
    };
    const { error } = await db
      .from("archive_emails")
      .update({
        subject: data.subject,
        message_body: data.message || null,
        recipients: data.recipients,
        scheduled_for: when.toISOString(),
        send_payload: nextPayload,
      } as never)
      .eq("id", data.emailId)
      .eq("status", "scheduled");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Moves scheduled emails to new send times (calendar drag and drop). Admin only. */
export const rescheduleEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { moves: { emailId: string; scheduledFor: string }[] }) => ({
    moves: (data.moves ?? []).slice(0, 50).map((m) => ({
      emailId: String(m.emailId),
      scheduledFor: String(m.scheduledFor),
    })),
  }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can change email.");
    for (const m of data.moves) {
      const when = new Date(m.scheduledFor);
      if (Number.isNaN(when.getTime())) throw new Error("That scheduled time is not valid.");
      if (when.getTime() < Date.now() + 60_000) throw new Error("Pick a day in the future.");
    }
    for (const m of data.moves) {
      const { error } = await db
        .from("archive_emails")
        .update({ scheduled_for: new Date(m.scheduledFor).toISOString() } as never)
        .eq("id", m.emailId)
        .eq("status", "scheduled");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
