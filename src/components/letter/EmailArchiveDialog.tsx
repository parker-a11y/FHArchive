import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchContacts } from "@/lib/archive-email";
import { sendArchiveEmail } from "@/lib/archive-email.functions";

type Recipient = { email: string; name?: string | null };

type RecordRef = { kind: "letter" | "source"; id: string; identifier: string; title?: string | null };

export function EmailArchiveDialog({
  kind,
  id,
  identifier,
  title,
  records,
  trigger,
}: {
  kind?: "letter" | "source";
  id?: string;
  identifier?: string;
  title?: string | null;
  records?: RecordRef[];
  trigger?: ReactNode;
}) {
  const recordList: RecordRef[] =
    records ?? [{ kind: kind!, id: id!, identifier: identifier!, title }];
  const identifiers = recordList.map((r) => r.identifier).join(", ");
  const single = recordList.length === 1 ? recordList[0] : null;
  const send = useServerFn(sendArchiveEmail);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [entry, setEntry] = useState("");
  const [subject, setSubject] = useState(
    single?.title
      ? `${single.identifier} — ${single.title}`
      : `${identifiers} from The Francis Files`,
  );
  const [headerSubtitle, setHeaderSubtitle] = useState("From The Francis Files");
  const [message, setMessage] = useState("");
  const [includeTranscription, setIncludeTranscription] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);

  const { data: contacts = [] } = useQuery({
    queryKey: ["archive-contacts"],
    queryFn: fetchContacts,
    enabled: open,
  });

  // Prefill the message with the record's short AI summary / description.
  useEffect(() => {
    if (!open || message || !single) return;
    (async () => {
      try {
        if (single.kind === "letter") {
          const { data } = await supabase
            .from("letters")
            .select("summary_short, summary_long")
            .eq("id", single.id)
            .maybeSingle();
          const s = (data?.summary_short as string) || (data?.summary_long as string) || "";
          if (s) setMessage(s);
        } else {
          const { data } = await supabase
            .from("digital_sources")
            .select("description")
            .eq("id", single.id)
            .maybeSingle();
          const s = (data?.description as string) || "";
          if (s) setMessage(s);
        }
      } catch {
        // Prefill is a convenience — never block the dialog.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, single?.id]);

  const addRecipient = (email: string, name?: string | null) => {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast.error("That does not look like an email address");
      return;
    }
    if (recipients.some((r) => r.email === value)) return;
    setRecipients((prev) => [...prev, { email: value, name: name ?? null }]);
    setEntry("");
  };

  const submit = async () => {
    if (recipients.length === 0) return toast.error("Add at least one recipient");
    setBusy(true);
    try {
      const res = await send({
        data: {
          recipients,
          subject,
          headerTitle: subject,
          headerSubtitle,
          message,
          records: recordList.map((r) => ({ kind: r.kind, id: r.id })),
          includeTranscription,
          includeImages,
        },
      });
      if (res.sent.length) toast.success(`Sent to ${res.sent.join(", ")}`);
      if (res.suppressed.length)
        toast.warning(`Skipped (previously unsubscribed or bounced): ${res.suppressed.join(", ")}`);
      for (const f of res.failed) toast.error(`${f.email}: ${f.error}`);
      if (res.failed.length === 0) {
        setOpen(false);
        setMessage("");
      }
    } catch (error) {
      toast.error((error as Error).message || "Could not send the email");
    } finally {
      setBusy(false);
    }
  };

  const suggestions = contacts
    .filter(
      (c) =>
        !recipients.some((r) => r.email === c.email) &&
        (entry.length === 0 ||
          c.email.includes(entry.toLowerCase()) ||
          c.name.toLowerCase().includes(entry.toLowerCase())),
    )
    .slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="size-4" /> Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Email from the archive</DialogTitle>
          <DialogDescription>
            Sends {identifiers} as a formatted email. Scans travel as an unlisted archive link you
            can switch off later — file attachments are not supported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">To</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {recipients.map((r) => (
                <span
                  key={r.email}
                  className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs"
                >
                  {r.email}
                  <button
                    type="button"
                    onClick={() => setRecipients((p) => p.filter((x) => x.email !== r.email))}
                    aria-label={`Remove ${r.email}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addRecipient(entry);
                  }
                }}
                placeholder="name@example.com"
              />
              <Button type="button" variant="secondary" onClick={() => addRecipient(entry)}>
                <Plus className="size-4" />
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addRecipient(c.email, c.name)}
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
                  >
                    {c.name} · {c.email}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">Subject</label>
            <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Header subtitle
            </label>
            <Input
              className="mt-1"
              value={headerSubtitle}
              onChange={(e) => setHeaderSubtitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">Message</label>
            <Textarea
              className="mt-1 min-h-28"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="A note to go above the record…"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeImages}
                onCheckedChange={(v) => setIncludeImages(Boolean(v))}
              />
              Include scan images in the email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeTranscription}
                onCheckedChange={(v) => setIncludeTranscription(Boolean(v))}
              />
              Include the transcription
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
