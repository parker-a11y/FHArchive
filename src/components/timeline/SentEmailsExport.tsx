import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildEmailsCsv } from "@/lib/timeline-export";
import { downloadBlob, loadRows, type Letter } from "./TimelineSummaryExport";

const SLIM =
  "id, fh_seq, archive_id, title, author, recipient, origin, destination, normalized_date, date_as_written, date_end, date_precision, date_certainty, date_from_postmark, record_type";

type Payload = { records?: { kind?: string; id?: string }[] } | null;

async function buildSentEmails(): Promise<string> {
  const emails: { subject: string; message_body: string | null; send_payload: unknown }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("archive_emails")
      .select("subject, message_body, send_payload, sent_at")
      .in("status", ["sent", "partial"])
      .order("sent_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    emails.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const idsOf = (p: unknown) => ((p as Payload)?.records ?? []).filter((r) => r.kind === "letter" && r.id).map((r) => r.id!);
  const ids = [...new Set(emails.flatMap((e) => idsOf(e.send_payload)))];
  const letters: Letter[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from("letters").select(SLIM).in("id", ids.slice(i, i + 100));
    if (error) throw error;
    letters.push(...((data ?? []) as unknown as Letter[]));
  }
  const rows = await loadRows(letters);
  const rowByArchive = new Map(rows.map((r) => [r.archiveId, r]));
  const rowById = new Map(letters.map((l) => [l.id, rowByArchive.get(l.archive_id)]));
  return buildEmailsCsv(emails.map((e) => ({
    subject: e.subject ?? "",
    body: e.message_body ?? "",
    records: idsOf(e.send_payload).map((id) => rowById.get(id)).filter((r): r is NonNullable<typeof r> => !!r),
  })));
}

export function SentEmailsExport() {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null);
  if (ready) {
    return (
      <Button size="sm" className="gap-2" onClick={() => { downloadBlob(ready.blob, ready.name); setReady(null); }}>
        <FileDown className="size-4" /> Download {ready.name}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" className="gap-2" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const csv = await buildSentEmails();
        setReady({ blob: new Blob([csv], { type: "text/csv;charset=utf-8" }), name: `FH_Sent_Emails_${new Date().toISOString().slice(0, 10)}.csv` });
      } catch (e) {
        toast.error((e as Error).message || "Could not build the sent emails export");
      } finally {
        setBusy(false);
      }
    }}>
      <FileDown className="size-4" /> {busy ? "Building emails…" : "Export Sent Emails (CSV)"}
    </Button>
  );
}
