import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { fetchPriorEmailSends } from "@/lib/archive-email.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextView } from "@/components/RichTextView";
import type { ArchiveEmail } from "@/lib/archive-email";

/** Read-only, permission-scoped history: opening an email never creates a public link. */
export function RecordEmailHistory({ letterId }: { letterId: string }) {
  const fetchHistory = useServerFn(fetchPriorEmailSends);
  const [emailId, setEmailId] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ["record-email-history", letterId],
    queryFn: () => fetchHistory({ data: { recordIds: [{ kind: "letter", id: letterId }] } }),
  });
  const email = useQuery({
    queryKey: ["record-email-view", emailId],
    enabled: Boolean(emailId),
    queryFn: async () => {
      if (!emailId) return null;
      const { data, error } = await supabase.from("archive_emails")
        .select("id, subject, header_title, header_subtitle, message_body, recipients, sent_at, status")
        .eq("id", emailId).in("status", ["sent", "partial"]).maybeSingle();
      if (error) throw error;
      return data as unknown as ArchiveEmail | null;
    },
  });

  if (history.isError) return <span className="text-xs text-muted-foreground">Email history unavailable <Button variant="link" size="sm" onClick={() => history.refetch()}>Try again</Button></span>;
  if (!history.data?.sends.length) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-label="Previously emailed records">
      <span className="field-label inline-flex items-center gap-1.5"><Mail className="size-3.5" /> Email records</span>
      <TooltipProvider delayDuration={150}>
        {history.data.sends.map((send) => (
          <Tooltip key={send.id}>
            <TooltipTrigger asChild>
              <Button variant="link" className="h-auto whitespace-normal p-0 text-sm underline underline-offset-2" onClick={() => setEmailId(send.id)} aria-label={`Open email: ${send.subject}`}>
                {send.sentAt ? new Date(send.sentAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Sent email"}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs space-y-1 break-words [overflow-wrap:anywhere]">
              <p className="font-semibold">{send.subject}</p>
              <p>Sent to: {send.recipients.join(", ")}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
      <Dialog open={Boolean(emailId)} onOpenChange={(open) => { if (!open) setEmailId(null); }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>{email.data?.subject ?? "Sent email"}</DialogTitle></DialogHeader>
          {email.isPending ? <p className="text-sm text-muted-foreground">Loading email…</p> : email.isError ? (
            <div><p>Could not load this email.</p><Button variant="outline" onClick={() => email.refetch()}>Try again</Button></div>
          ) : email.data ? (
            <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
              <div className="space-y-1 border-b border-border pb-3 text-sm text-muted-foreground">
                <p>Sent to: {email.data.recipients.map((recipient) => recipient.email).join(", ")}</p>
                <p>{new Date(email.data.sent_at).toLocaleString()}</p>
              </div>
              {email.data.header_title && <h2 className="font-display text-2xl">{email.data.header_title}</h2>}
              {email.data.header_subtitle && <p className="text-muted-foreground">{email.data.header_subtitle}</p>}
              <RichTextView text={email.data.message_body ?? ""} />
            </div>
          ) : <p>This email is no longer available.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}