import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function newToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ensures a sent email has a public view-only link (/e/<token>) and returns it.
 * Admin only. The page shows the email exactly as logged: subject, header,
 * message, and the records it included (each linking to its public share page
 * when one exists).
 */
export const ensureEmailShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { emailId: string }) => ({ emailId: String(data.emailId) }))
  .handler(async ({ data, context }): Promise<{ url: string; created: boolean }> => {
    const db = context.supabase;
    const { data: isAdmin } = await db.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Only archive administrators can create share links.");

    const { data: email } = await db
      .from("archive_emails")
      .select("id, share_token")
      .eq("id", data.emailId)
      .maybeSingle();
    if (!email) throw new Error("That email could not be found.");

    const { PUBLIC_SITE_URL } = await import("@/lib/archive-email.server");
    const existing = (email as { share_token?: string | null }).share_token;
    if (existing) return { url: `${PUBLIC_SITE_URL}/e/${existing}`, created: false };

    const token = newToken();
    const { error } = await db
      .from("archive_emails")
      .update({ share_token: token } as never)
      .eq("id", data.emailId);
    if (error) throw new Error(`Could not create a share link: ${error.message}`);
    return { url: `${PUBLIC_SITE_URL}/e/${token}`, created: true };
  });

export type SharedEmailRecord = {
  archiveId: string;
  title: string | null;
  recordType: string | null;
  date: string | null;
  /** Public /s/<token> page for this record, when an enabled share exists. */
  url: string | null;
};

export type SharedEmail = {
  subject: string;
  headerTitle: string | null;
  headerSubtitle: string | null;
  messageBody: string | null;
  senderEmail: string | null;
  sentAt: string;
  records: SharedEmailRecord[];
};

/** Public, unauthenticated read of one shared sent email. Whitelisted fields only. */
export const getSharedEmail = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data.token).slice(0, 64) }))
  .handler(async ({ data }): Promise<SharedEmail | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: email } = await supabaseAdmin
      .from("archive_emails")
      .select("id, subject, header_title, header_subtitle, message_body, sender_email, sent_at")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!email) return null;
    const e = email as Record<string, unknown>;

    const { data: recs } = await supabaseAdmin
      .from("archive_email_records")
      .select("letter_id, archive_id, sort_order")
      .eq("email_id", e['id'])
      .order("sort_order", { ascending: true });

    const records: SharedEmailRecord[] = [];
    for (const r of (recs ?? []) as Record<string, unknown>[]) {
      const [{ data: letter }, { data: share }] = await Promise.all([
        supabaseAdmin
          .from("letters")
          .select("title, record_type, normalized_date, date_as_written")
          .eq("id", r['letter_id'])
          .maybeSingle(),
        supabaseAdmin
          .from("record_shares")
          .select("token")
          .eq("letter_id", r['letter_id'])
          .eq("scope", "record")
          .eq("enabled", true)
          .limit(1)
          .maybeSingle(),
      ]);
      const l = (letter ?? {}) as Record<string, unknown>;
      const { PUBLIC_SITE_URL } = await import("@/lib/archive-email.server");
      records.push({
        archiveId: String(r['archive_id']),
        title: l['title'] == null ? null : String(l['title']),
        recordType: l['record_type'] == null ? null : String(l['record_type']),
        date:
          l['date_as_written'] != null
            ? String(l['date_as_written'])
            : l['normalized_date'] != null
              ? String(l['normalized_date'])
              : null,
        url: share ? `${PUBLIC_SITE_URL}/s/${(share as { token: string }).token}` : null,
      });
    }

    return {
      subject: String(e['subject']),
      headerTitle: e['header_title'] == null ? null : String(e['header_title']),
      headerSubtitle: e['header_subtitle'] == null ? null : String(e['header_subtitle']),
      messageBody: e['message_body'] == null ? null : String(e['message_body']),
      senderEmail: e['sender_email'] == null ? null : String(e['sender_email']),
      sentAt: String(e['sent_at']),
      records,
    };
  });
