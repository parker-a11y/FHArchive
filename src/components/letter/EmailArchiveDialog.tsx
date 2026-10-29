import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ContactEmailList, CONTACT_EMAIL_LIST_ID } from "@/components/letter/ContactEmailList";
import { Mail, Plus, X, Paperclip, Loader2 } from "lucide-react";
import type { EmailAttachment } from "@/lib/email-attachments";
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
import { Checkbox } from "@/components/ui/checkbox";
import { CopyShareLinkButton } from "@/components/letter/CopyShareLinkButton";
import { ArchivePhotoPicker } from "@/components/media/ArchivePhotoPicker";
import { RichTextEditor, insertTokenParagraph } from "@/components/editor/RichTextEditor";


import { fetchContacts, type EmailDraftPayload } from "@/lib/archive-email";
import { sendArchiveEmail, saveEmailDraft } from "@/lib/archive-email.functions";
import { postComposerBlog } from "@/lib/recaps.functions";
import {
  checkStaleTranscriptions,
  rollupRecordTranscription,
} from "@/lib/transcription.functions";

type Recipient = { email: string; name?: string | null };

type RecordRef = { kind: "letter" | "source"; id: string; identifier: string; title?: string | null; date?: string | null };

export type EmailResearchPayload = {
  question?: string | null;
  answer?: string | null;
  caveats?: string | null;
  confidence?: string | null;
  sources?: { title?: string | null; url: string }[];
};

export function EmailArchiveDialog({
  kind,
  id,
  identifier,
  title,
  records,
  trigger,
  defaultSubject,
  defaultMessage,
  description,
  defaultSendAt,
  research,
  thumbnails,
  draftId,
  draft,
  onDraftSaved,
}: {
  kind?: "letter" | "source";
  id?: string;
  identifier?: string;
  title?: string | null;
  records?: RecordRef[];
  trigger?: ReactNode;
  defaultSubject?: string;
  defaultMessage?: string;
  description?: ReactNode;
  /** Pre-arms "Send later" with this local datetime (yyyy-MM-ddTHH:mm). */
  defaultSendAt?: string;
  /** Ask Francis result sent as its own block, independent of the note. */
  research?: EmailResearchPayload;
  /** Show one small clickable thumbnail per record instead of full scans. */
  thumbnails?: boolean;
  /** Existing draft row being edited; removed once the email is sent/scheduled. */
  draftId?: string;
  /** Saved draft values to restore into the composer. */
  draft?: EmailDraftPayload | null;
  /** Called after a draft is saved or the email is sent/scheduled. */
  onDraftSaved?: () => void;
}) {
  const recordList: RecordRef[] =
    records ?? (id && kind && identifier ? [{ kind, id, identifier, title }] : []);
  const identifiers = recordList.map((r) => r.identifier).join(", ");
  const single = recordList.length === 1 ? recordList[0] : null;
  const send = useServerFn(sendArchiveEmail);
  const saveDraftFn = useServerFn(saveEmailDraft);
  const qc = useQueryClient();
  // The composer is used from many pages; always refresh Email Admin's lists.
  const refreshEmailLists = () => {
    qc.invalidateQueries({ queryKey: ["archive-email-drafts"] });
    qc.invalidateQueries({ queryKey: ["archive-emails"] });
    onDraftSaved?.();
  };
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>(draft?.attachments ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again to upload files.");
      for (const file of Array.from(files)) {
        const storagePath = `${user.id}/email-attachments/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("ds-files").upload(storagePath, file);
        if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);
        setAttachments((current) => [...current, { filename: file.name, storagePath, fileSize: file.size }]);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const [recipients, setRecipients] = useState<Recipient[]>(draft?.recipients ?? []);
  const [entry, setEntry] = useState("");
  const [savedDraftId, setSavedDraftId] = useState<string | null>(draftId ?? null);
  const [subject, setSubject] = useState(
    draft?.subject ??
      defaultSubject ??
      (single?.title
        ? `${single.identifier} — ${single.title}`
        : `${identifiers || "A note"} from The Francis Files`),
  );
  const [headerSubtitle, setHeaderSubtitle] = useState(draft?.headerSubtitle ?? "From The Francis Files");
  const [message, setMessage] = useState(draft?.message ?? defaultMessage ?? "");
  const [includeTranscription, setIncludeTranscription] = useState(draft?.includeTranscription ?? true);
  const [includeImages, setIncludeImages] = useState(draft?.includeImages ?? true);
  const editorRef = useRef<import("@tiptap/react").Editor | null>(null);
  // Reset the subject whenever the dialog switches to a different record,
  // so a previous record's title can never carry over.
  const recordKey = recordList.map((r) => r.identifier).join("|");
  const singleTitle = single?.title ?? null;
  useEffect(() => {
    // A restored draft keeps its saved subject.
    if (draft?.subject) return;
    setSubject(
      defaultSubject ??
        (single?.title
          ? `${single.identifier} — ${single.title}`
          : `${identifiers || "A note"} from The Francis Files`),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordKey, singleTitle, defaultSubject]);
  // Warn when the subject names an FH/DS number or ISO date that doesn't
  // belong to any record being sent.
  const subjectMismatch = (() => {
    const known = recordList.map((r) => `${r.identifier} ${r.title ?? ""} ${r.date ?? ""}`).join(" ").toUpperCase();
    const ids = subject.toUpperCase().match(/\b(?:FH|DS)-?\d{3,5}\b/g) ?? [];
    const dates = subject.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
    const bad = [
      ...ids.filter((x) => !known.includes(x.replace("-", ""))),
      ...dates.filter((x) => !known.includes(x)),
    ];
    return bad.length ? bad : null;
  })();

  const [includeEnvelope, setIncludeEnvelope] = useState(draft?.includeEnvelope ?? true);
  const [later, setLater] = useState(Boolean(defaultSendAt));
  const [sendAt, setSendAt] = useState(defaultSendAt ?? "");
  // Keep the scheduled time in step with a day picked after this dialog mounted.
  useEffect(() => {
    if (!defaultSendAt) return;
    setLater(true);
    setSendAt(defaultSendAt);
  }, [defaultSendAt]);

  // --- Unsaved-work protection -------------------------------------------------
  // A surprise logout used to wipe everything typed into the composer. The
  // composer mirrors itself to localStorage (debounced) and restores on open,
  // so losing the session never loses the email. Cleared on send/schedule and
  // on a deliberate draft save.
  const autosaveKey = `fh-email-composer:${recordKey || "note"}`;

  const restoreAutosave = () => {
    try {
      const raw = localStorage.getItem(autosaveKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        attachments?: EmailAttachment[];
        subject?: string;
        headerSubtitle?: string;
        message?: string;
        recipients?: Recipient[];
        includeTranscription?: boolean;
        includeImages?: boolean;
        includeEnvelope?: boolean;
        later?: boolean;
        sendAt?: string;
      };
      if (saved.subject !== undefined) setSubject(saved.subject);
      if (saved.attachments) setAttachments(saved.attachments);
      if (saved.headerSubtitle !== undefined) setHeaderSubtitle(saved.headerSubtitle);
      if (saved.message !== undefined) setMessage(saved.message);
      if (saved.recipients) setRecipients(saved.recipients);
      if (saved.includeTranscription !== undefined) setIncludeTranscription(saved.includeTranscription);
      if (saved.includeImages !== undefined) setIncludeImages(saved.includeImages);
      if (saved.includeEnvelope !== undefined) setIncludeEnvelope(saved.includeEnvelope);
      if (saved.later !== undefined) setLater(saved.later);
      if (saved.sendAt !== undefined) setSendAt(saved.sendAt);
      toast("Restored your unsaved edits from before the interruption");
    } catch {
      /* corrupted snapshot — ignore */
    }
  };

  const clearAutosave = () => {
    try {
      localStorage.removeItem(autosaveKey);
    } catch {
      /* ignore */
    }
  };

  // Restore before the summary-prefill effect runs, so a restored message is
  // never overwritten by the record's AI summary.
  const handleOpenChange = (v: boolean) => {
    if (v) restoreAutosave();
    setOpen(v);
  };

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          autosaveKey,
          JSON.stringify({
            attachments,
            subject,
            headerSubtitle,
            message,
            recipients,
            includeTranscription,
            includeImages,
            includeEnvelope,
            later,
            sendAt,
          }),
        );
      } catch {
        /* storage full — protection simply stops */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [
    open,
    autosaveKey,
    attachments,
    subject,
    headerSubtitle,
    message,
    recipients,
    includeTranscription,
    includeImages,
    includeEnvelope,
    later,
    sendAt,
  ]);
  const pickNextSlot = async () => {
    const { data, error } = await supabase
      .from("archive_emails")
      .select("scheduled_for")
      .eq("status", "scheduled")
      .not("scheduled_for", "is", null);
    if (error) return toast.error(error.message);
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const busy = new Set((data ?? []).map((r) => key(new Date(r.scheduled_for as string))));
    const d = new Date();
    d.setHours(11, 0, 0, 0);
    if (d.getTime() <= Date.now() + 60_000) d.setDate(d.getDate() + 1);
    while (busy.has(key(d))) d.setDate(d.getDate() + 1);
    setSendAt(`${key(d)}T11:00`);
    toast.success(
      `Next open day: ${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} at 11:00am`,
    );
  };
  const hasLetter = recordList.some((r) => r.kind === "letter");


  const { data: contacts = [] } = useQuery({
    queryKey: ["archive-contacts"],
    queryFn: fetchContacts,
    enabled: open,
  });

  // Prefill the message with the record's short AI summary / description.
  useEffect(() => {
    // A caller-supplied message (e.g. an Ask Francis answer) must never be
    // replaced by the record summary — including on a second send.
    if (!open || message || defaultMessage || !single) return;
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

  /**
   * A combined transcription can lag behind corrections made on individual
   * pages; emailing that stale copy is exactly the bug this guards against.
   */
  const letterIds = recordList.filter((r) => r.kind === "letter").map((r) => r.id);
  const [stale, setStale] = useState<{ letterId: string; handEdited: boolean }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!open || !includeTranscription || letterIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await checkStaleTranscriptions({ data: { letterIds } });
        if (!cancelled) setStale(res ?? []);
      } catch {
        // Advisory only — never block sending.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, includeTranscription, letterIds.join(",")]);

  const refreshStale = async () => {
    setRefreshing(true);
    try {
      for (const s of stale) {
        await rollupRecordTranscription({ data: { letterId: s.letterId, force: true } });
      }
      setStale([]);
      toast.success("Transcriptions refreshed from the latest page text");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const staleIds = stale
    .map((s) => recordList.find((r) => r.id === s.letterId)?.identifier)
    .filter(Boolean)
    .join(", ");

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
    if (later && !sendAt) return toast.error("Pick a date and time to send");
    if (
      subjectMismatch &&
      !window.confirm(
        `The subject mentions ${subjectMismatch.join(", ")}, which doesn't match the record being sent. Send anyway?`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await send({
        data: {
          attachments,
          recipients,
          subject,
          headerTitle: subject,
          headerSubtitle,
          message,
          records: recordList.map((r) => ({ kind: r.kind, id: r.id })),
          includeTranscription,
          includeImages,
          includeEnvelope,
          research: research?.answer ? research : null,
          thumbnails: Boolean(thumbnails),
          scheduledFor: later && sendAt ? new Date(sendAt).toISOString() : null,
          draftId: savedDraftId,
        },
      });
      refreshEmailLists();
      if (res.scheduledFor) {
        toast.success(`Scheduled for ${new Date(res.scheduledFor).toLocaleString()}`);
        clearAutosave();
        setOpen(false);
        setLater(false);
        setAttachments([]);
        setMessage(defaultMessage ?? "");
        return;
      }
      if (res.sent.length) toast.success(`Sent to ${res.sent.join(", ")}`);
      if (res.suppressed.length)
        toast.warning(`Skipped (previously unsubscribed or bounced): ${res.suppressed.join(", ")}`);
      for (const f of res.failed) toast.error(`${f.email}: ${f.error}`);
      if (res.failed.length === 0) {
        setAttachments([]);
        clearAutosave();
        setOpen(false);
        setMessage(defaultMessage ?? "");
      }
    } catch (error) {
      toast.error((error as Error).message || "Could not send the email");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      const res = await saveDraftFn({
        data: {
          attachments,
          draftId: savedDraftId,
          subject,
          headerSubtitle,
          message,
          recipients,
          records: recordList.map((r) => ({ kind: r.kind, id: r.id })),
          includeTranscription,
          includeImages,
          includeEnvelope,
          thumbnails: Boolean(thumbnails),
          research: research?.answer ? research : null,
        },
      });
      setSavedDraftId(res.draftId);
      toast.success("Draft saved — find it at the top of Email Admin");
      clearAutosave();
      setOpen(false);
      refreshEmailLists();
    } catch (error) {
      toast.error((error as Error).message || "Could not save the draft");
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="size-4" /> Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="grid-cols-1 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Email from the archive</DialogTitle>
          <DialogDescription>
            {description ??
              (recordList.length > 0
                ? `Sends ${identifiers} as a formatted email. Scans travel as an unlisted archive link you can switch off later — file attachments are not supported.`
                : "Sends this as a formatted email from the archive.")}
          </DialogDescription>
          {single?.kind === "letter" && (
            <div className="pt-1">
              <CopyShareLinkButton letterId={single.id} size="sm" label="Copy share link" />
            </div>
          )}
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
                list={CONTACT_EMAIL_LIST_ID}
                autoComplete="off"
              />
              <ContactEmailList />
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
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">Subject</label>
            <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
            {subjectMismatch && (
              <p className="mt-1 text-xs font-medium text-destructive">
                Heads up: the subject mentions {subjectMismatch.join(", ")}, which doesn't match the
                record being sent{single ? ` (${single.identifier}${single.title ? ` — ${single.title}` : ""})` : ""}.
              </p>
            )}
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
            {message.length > 90000 && (
              <p className="mt-1 text-xs text-destructive">
                {message.length > 100000
                  ? "This message is too long — anything past the limit will be cut off. Please shorten it."
                  : "This message is close to the length limit."}
              </p>
            )}
            <RichTextEditor
              className="mt-1"
              value={message}
              onChange={setMessage}
              minHeight="28rem"
              placeholder={recordList.length ? "A note to go above the record…" : "Write your email…"}
              onEditorReady={(e) => {
                editorRef.current = e;
              }}
              toolbarExtras={
                <ArchivePhotoPicker
                  onInsert={(token) => insertTokenParagraph(editorRef.current, token)}
                />
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use the toolbar for bold, italic, underline, headings, lists and alignment. Inserted
              photos appear in the email captioned with their record number.
            </p>
          </div>



          <div className="space-y-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" aria-label="Email attachments" onChange={(e) => void uploadFiles(e.target.files)} />
            <Button type="button" variant="outline" className="gap-2" disabled={uploading || busy} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              {uploading ? "Uploading…" : "Attachment Upload"}
            </Button>
            {attachments.map((file) => (
              <div key={file.storagePath} className="flex min-w-0 items-center gap-2 text-sm">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 break-all">{file.filename}</span>
                <Button type="button" variant="ghost" size="icon" title={`Remove ${file.filename}`} aria-label={`Remove attachment ${file.filename}`} disabled={busy} onClick={() => setAttachments((current) => current.filter((f) => f.storagePath !== file.storagePath))}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          {recordList.length > 0 && <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeImages}
                onCheckedChange={(v) => setIncludeImages(Boolean(v))}
              />
              Include scan images in the email
            </label>
            {hasLetter && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeEnvelope}
                  onCheckedChange={(v) => setIncludeEnvelope(Boolean(v))}
                />
                Include the envelope scan
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeTranscription}
                onCheckedChange={(v) => setIncludeTranscription(Boolean(v))}
              />
              Include the transcription
            </label>
            {includeTranscription && stale.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
                <span>
                  The combined transcription for {staleIds} is older than the corrected page text —
                  the email would send the earlier wording.
                </span>
                <Button size="sm" variant="outline" onClick={refreshStale} disabled={refreshing}>
                  {refreshing ? "Refreshing…" : "Use latest page text"}
                </Button>
              </div>
            )}
          </div>}
        </div>

        {!blogMode && (<div className="space-y-2 rounded border border-border px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={later} onCheckedChange={(v) => setLater(Boolean(v))} />
            Send later
          </label>
          {later && (
            <div className="flex flex-wrap gap-2">
              <Input
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
                aria-label="Scheduled send time"
                className="min-w-0 flex-1"
              />
              <Button type="button" variant="outline" onClick={pickNextSlot}>
                Next available slot
              </Button>
            </div>
          )}
          {later && (
            <p className="text-xs text-muted-foreground">
              Goes out within about 5 minutes of this time. You can cancel it from Sent Email.
            </p>
          )}
        </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy || uploading}>
            Cancel
          </Button>
          <Button variant="outline" onClick={saveDraft} disabled={busy || uploading}>
            {savedDraftId ? "Update draft" : "Save draft"}
          </Button>
          <Button onClick={submit} disabled={busy || uploading}>
            {busy
              ? blogMode
                ? "Posting…"
                : later
                  ? "Scheduling…"
                  : "Sending…"
              : blogMode
                ? "Post blog"
                : later
                  ? "Schedule email"
                  : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
