import { supabase } from "@/integrations/supabase/client";

export type ArchiveContact = {
  id: string;
  name: string;
  email: string;
  notes: string | null;
  last_used_at: string | null;
};

export type ArchiveEmail = {
  id: string;
  subject: string;
  message_body: string | null;
  header_title: string | null;
  header_subtitle: string | null;
  recipients: { email: string; name?: string | null }[];
  status: string;
  error: string | null;
  sent_at: string;
};

export async function fetchContacts(): Promise<ArchiveContact[]> {
  const { data, error } = await supabase
    .from("archive_contacts")
    .select("id, name, email, notes, last_used_at")
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ArchiveContact[];
}

export async function fetchSentEmails(): Promise<ArchiveEmail[]> {
  const { data, error } = await supabase
    .from("archive_emails")
    .select("id, subject, message_body, header_title, header_subtitle, recipients, status, error, sent_at")
    .order("sent_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as ArchiveEmail[];
}

export async function fetchEmailRecords(emailId: string) {
  const { data, error } = await supabase
    .from("archive_email_records")
    .select("archive_id, letter_id, sort_order")
    .eq("email_id", emailId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
