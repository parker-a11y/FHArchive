import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { updateScheduledEmail } from "@/lib/archive-email.functions";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function EditScheduledEmailButton({ emailId }: { emailId: string }) {
  const save = useServerFn(updateScheduledEmail);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [when, setWhen] = useState("");
  const [recipients, setRecipients] = useState("");

  const openEditor = async () => {
    setOpen(true);
    setLoading(true);
    const { data, error } = await supabase
      .from("archive_emails")
      .select("subject, message_body, recipients, scheduled_for, send_payload")
      .eq("id", emailId)
      .maybeSingle();
    setLoading(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not load that email");
      return setOpen(false);
    }
    const row = data as unknown as {
      subject: string;
      message_body: string | null;
      recipients: { email: string }[] | null;
      scheduled_for: string | null;
      send_payload: { message?: string } | null;
    };
    setSubject(row.subject ?? "");
    setMessage(row.send_payload?.message ?? row.message_body ?? "");
    setRecipients((row.recipients ?? []).map((r) => r.email).join(", "));
    setWhen(row.scheduled_for ? toLocalInput(row.scheduled_for) : "");
  };

  const submit = async () => {
    const emails = recipients.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!when) return toast.error("Pick a send time");
    setBusy(true);
    try {
      await save({
        data: {
          emailId,
          subject,
          message,
          scheduledFor: new Date(when).toISOString(),
          recipients: emails.map((email) => ({ email })),
        },
      });
      toast.success("Scheduled email updated");
      qc.invalidateQueries({ queryKey: ["archive-emails"] });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1" onClick={openEditor}>
        <Pencil className="size-3.5" /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit scheduled email</DialogTitle>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="field-label">Send at</span>
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="field-label">Recipients</span>
                <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="name@example.com, …" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="field-label">Subject</span>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <div className="space-y-1 text-sm">
                <span className="field-label">Message</span>
                <RichTextEditor value={message} onChange={setMessage} />
              </div>
              <p className="text-xs text-muted-foreground">The attached records and scans stay as they are.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || loading}>{busy ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
