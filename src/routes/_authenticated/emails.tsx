import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ContactEmailList, CONTACT_EMAIL_LIST_ID } from "@/components/letter/ContactEmailList";
import { Check, ChevronLeft, ChevronRight, Link2, Loader2, Send } from "lucide-react";
import { AdminOnly, AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import {
  fetchAllEmailRecords,
  fetchEmailLetterList,
  fetchSentEmails,
  type ArchiveEmail,
  type EmailRecordRef,
} from "@/lib/archive-email";
import { ensureEmailShareLink } from "@/lib/email-share.functions";
import { addScheduledRecipients, cancelScheduledEmail } from "@/lib/archive-email.functions";
import { useQueryClient } from "@tanstack/react-query";
import { RichTextView } from "@/components/RichTextView";
import { isRichHtml } from "@/lib/rich-text";
import {
  EmailScratchpadButton,
  fetchEmailScratchpads,
  SCRATCHPAD_QUERY_KEY,
} from "@/components/letter/EmailScratchpadButton";
import { cn } from "@/lib/utils";
import { EditScheduledEmailButton } from "@/components/letter/EditScheduledEmailButton";

export const Route = createFileRoute("/_authenticated/emails")({
  component: () => (
    <AdminOnly>
      <EmailsPage />
    </AdminOnly>
  ),
  head: () => ({
    meta: [
      { title: "Email Admin · The Francis Files" },
      {
        name: "description",
        content:
          "Schedule, track and review archive emails from The Francis Files — one letter a day.",
      },
      { property: "og:title", content: "Email Admin · The Francis Files" },
      {
        property: "og:description",
        content: "Dispatch calendar, letter coverage and delivery history for The Francis Files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const STATUS_STYLES: Record<string, string> = {
  sent: "border-primary/40 bg-primary/10 text-primary",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  suppressed: "border-border bg-secondary text-muted-foreground",
  sending: "border-border bg-secondary text-muted-foreground",
  scheduled: "border-accent bg-accent text-accent-foreground",
  cancelled: "border-border bg-secondary text-muted-foreground line-through",
};

const SENT_STATUSES = new Set(["sent", "partial"]);

/** Creates (or reuses) the public view-only page for this email and copies its link. */
function GetEmailLinkButton({ emailId }: { emailId: string }) {
  const ensure = useServerFn(ensureEmailShareLink);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const copy = async () => {
    setBusy(true);
    try {
      const res = await ensure({ data: { emailId } });
      try {
        await navigator.clipboard.writeText(res.url);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
        toast.success(res.created ? "Link created and copied" : "Link copied", {
          description: res.url,
        });
      } catch {
        toast.message("Link ready — copy it below", { description: res.url });
      }
    } catch (error) {
      toast.error((error as Error).message || "Could not create a link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={copy} disabled={busy}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : done ? (
        <Check className="size-4 text-emerald-600" />
      ) : (
        <Link2 className="size-4" />
      )}
      Get link
    </Button>
  );
}

function AddRecipientsButton({ emailId }: { emailId: string }) {
  const add = useServerFn(addScheduledRecipients);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const emails = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (emails.length === 0) return toast.error("Type at least one email address");
    setBusy(true);
    try {
      await add({ data: { emailId, recipients: emails.map((email) => ({ email })) } });
      toast.success("Recipients added");
      qc.invalidateQueries({ queryKey: ["archive-emails"] });
      setText("");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add recipients
      </Button>
    );
  return (
    <span className="flex gap-1">
      <ContactEmailList />
      <Input
        autoFocus
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") submit();
          if (ev.key === "Escape") setOpen(false);
        }}
        placeholder="name@example.com, …"
        list={CONTACT_EMAIL_LIST_ID}
        autoComplete="off"
        className="h-8 w-56"
      />
      <Button size="sm" onClick={submit} disabled={busy}>
        {busy ? "Adding…" : "Add"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
        Cancel
      </Button>
    </span>
  );
}

function CancelScheduledButton({ emailId }: { emailId: string }) {
  const cancel = useServerFn(cancelScheduledEmail);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await cancel({ data: { emailId } });
          toast.success("Scheduled email cancelled");
          qc.invalidateQueries({ queryKey: ["archive-emails"] });
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      Cancel send
    </Button>
  );
}

/* ------------------------------ calendar ------------------------------ */

type DayEntry = {
  kind: "sent" | "scheduled";
  emailId: string;
  subject: string;
  time: string;
  ids: string[];
};

function localDayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function Calendar({
  emails,
  recordsByEmail,
  onPickDay,
  selectedDay,
}: {
  emails: ArchiveEmail[];
  recordsByEmail: Map<string, string[]>;
  onPickDay: (key: string) => void;
  selectedDay: string | null;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const byDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    for (const e of emails) {
      const scheduled = e.status === "scheduled" && e.scheduled_for;
      const when = scheduled ? e.scheduled_for! : e.sent_at;
      if (!when) continue;
      if (!scheduled && !SENT_STATUSES.has(e.status)) continue;
      const key = localDayKey(when);
      const entry: DayEntry = {
        kind: scheduled ? "scheduled" : "sent",
        emailId: e.id,
        subject: e.subject,
        time: new Date(when).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        ids: recordsByEmail.get(e.id) ?? [],
      };
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [emails, recordsByEmail]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = localDayKey(today.toISOString());

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Dispatch calendar</h2>
          <p className="text-xs text-muted-foreground">
            Pick an empty day to schedule the next letter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-36 text-center text-sm font-medium">
            {cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="min-h-16 rounded" />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          // One email per recipient means the same dispatch repeats — show it once.
          const all = byDay.get(key) ?? [];
          const seen = new Set<string>();
          const unique = all.filter((e) => {
            const sig = `${e.kind}|${e.ids.join(",")}|${e.subject}`;
            if (seen.has(sig)) return false;
            seen.add(sig);
            return true;
          });
          const entries = unique.slice(0, 3);
          const extra = unique.length - entries.length;
          const empty = entries.length === 0;
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(key)}
              className={cn(
                "min-h-16 rounded border p-1 text-left text-[11px] transition-colors",
                empty
                  ? "border-dashed border-border bg-background hover:bg-secondary"
                  : "border-border bg-secondary/40",
                isSelected && "ring-2 ring-primary",
              )}
            >
              <span
                className={cn(
                  "inline-block rounded px-1 text-xs font-medium",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {day}
              </span>
              <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {unique.map((e) => (
                  <span
                    key={e.emailId}
                    className={cn(
                      "size-2 rounded-full",
                      e.kind === "sent" ? "bg-emerald-500" : "bg-sky-500",
                    )}
                  />
                ))}
              </span>
              {entries.map((e) => (
                <span
                  key={e.emailId}
                  className={cn(
                    "mt-1 hidden truncate rounded px-1 py-0.5 sm:block",
                    e.kind === "sent"
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-sky-500/15 text-sky-700",
                  )}
                  title={`${e.subject} — ${e.time}`}
                >
                  {e.ids.length ? e.ids.join(", ") : e.subject}
                </span>
              ))}
              {extra > 0 && (
                <span className="mt-1 hidden text-muted-foreground sm:block">+{extra} more</span>
              )}
              {empty && <span className="mt-1 hidden text-muted-foreground sm:block">open</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" /> Sent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-sky-500" /> Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-dashed border-muted-foreground" /> Open day
        </span>
      </div>
    </section>
  );
}

/* --------------------------- letter coverage --------------------------- */

type LetterState = "sent" | "queued" | "never";

const FILTERS: { key: LetterState | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "never", label: "Never sent" },
  { key: "queued", label: "In queue" },
  { key: "sent", label: "Previously sent" },
];

const DOT: Record<LetterState, string> = {
  sent: "bg-emerald-500",
  queued: "bg-sky-500",
  never: "bg-slate-300",
};

const DOT_LABEL: Record<LetterState, string> = {
  sent: "Previously sent",
  queued: "In queue to be sent",
  never: "Never sent",
};

function EmailsPage() {
  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["archive-emails"],
    queryFn: fetchSentEmails,
  });
  const { data: emailRecords = [] } = useQuery({
    queryKey: ["archive-email-records"],
    queryFn: fetchAllEmailRecords,
  });
  const { data: letters = [] } = useQuery({
    queryKey: ["email-letter-list"],
    queryFn: fetchEmailLetterList,
  });
  const { data: scratchpads = {} } = useQuery({
    queryKey: SCRATCHPAD_QUERY_KEY,
    queryFn: fetchEmailScratchpads,
  });

  const [filter, setFilter] = useState<LetterState | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");

  const lookupId = useMemo(() => {
    const raw = lookup.trim().toUpperCase().replace(/\s|-/g, "");
    if (!raw) return null;
    const m = raw.match(/^(FH|DS)?(\d+)$/);
    if (!m) return raw;
    return `${m[1] ?? "FH"}${m[2].padStart(4, "0")}`;
  }, [lookup]);

  const lookupEmails = useMemo(() => {
    if (!lookupId) return [];
    const ids = new Set(
      (emailRecords as EmailRecordRef[])
        .filter((r) => r.archive_id.toUpperCase() === lookupId)
        .map((r) => r.email_id),
    );
    return emails.filter((e) => ids.has(e.id));
  }, [lookupId, emailRecords, emails]);

  const sheetEmails = useMemo(() => {
    if (!sheetDay) return [];
    return emails.filter((e) => {
      const scheduled = e.status === "scheduled" && e.scheduled_for;
      const when = scheduled ? e.scheduled_for! : e.sent_at;
      if (!when) return false;
      if (!scheduled && !SENT_STATUSES.has(e.status)) return false;
      return localDayKey(when) === sheetDay;
    });
  }, [sheetDay, emails]);

  const renderEmail = (e: ArchiveEmail, startOpen = false) => {
    const recs = emailRecords
      .filter((r) => r.email_id === e.id)
      .map((r) => ({ kind: "letter" as const, id: r.letter_id, identifier: r.archive_id }));
    return (
      <details
        key={e.id}
        open={startOpen}
        className="rounded-lg border border-border bg-card px-4 py-3 open:shadow-sm"
      >
        <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
          <span
            className={`rounded border px-1.5 py-0.5 text-xs ${
              STATUS_STYLES[e.status] ?? STATUS_STYLES["sending"]
            }`}
          >
            {e.status}
          </span>
          {recs.length > 0 && (
            <span className="font-mono text-xs font-semibold">
              {recs.map((r) => r.identifier).join(", ")}
            </span>
          )}
          <span className="min-w-0 break-words font-medium">{e.subject}</span>
          <span className="min-w-0 break-all text-muted-foreground">
            {(e.recipients ?? []).map((r) => r.email).join(", ")}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {e.status === "scheduled" && e.scheduled_for
              ? `Sends ${new Date(e.scheduled_for).toLocaleString()}`
              : new Date(e.sent_at).toLocaleString()}
          </span>
          {e.status === "scheduled" && (
            <span
              className="flex flex-wrap gap-2"
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
              }}
              onKeyDown={(ev) => ev.stopPropagation()}
            >
              <EditScheduledEmailButton emailId={e.id} />
              <AddRecipientsButton emailId={e.id} />
              <CancelScheduledButton emailId={e.id} />
            </span>
          )}
          <span
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
            }}
          >
            <GetEmailLinkButton emailId={e.id} />
          </span>
        </summary>
        <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
          {e.message_body &&
            (isRichHtml(e.message_body) ? (
              <RichTextView html={e.message_body} />
            ) : (
              <p className="whitespace-pre-wrap">{e.message_body}</p>
            ))}
          {e.error && <p className="text-destructive">{e.error}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <EmailArchiveDialog
              records={recs}
              defaultSubject={e.subject}
              defaultMessage={e.message_body ?? ""}
              description="Send this same email again — add the new recipients below."
              trigger={
                <Button variant="outline" size="sm" className="gap-2">
                  <Send className="size-4" /> Send again
                </Button>
              }
            />
          </div>
        </div>
      </details>
    );
  };

  const statusById = useMemo(() => new Map(emails.map((e) => [e.id, e.status])), [emails]);

  const recordsByEmail = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of emailRecords as EmailRecordRef[]) {
      map.set(r.email_id, [...(map.get(r.email_id) ?? []), r.archive_id]);
    }
    return map;
  }, [emailRecords]);

  const letterState = useMemo(() => {
    const map = new Map<string, LetterState>();
    for (const r of emailRecords as EmailRecordRef[]) {
      const status = statusById.get(r.email_id);
      if (!status) continue;
      const current = map.get(r.letter_id);
      if (SENT_STATUSES.has(status)) map.set(r.letter_id, "sent");
      else if (status === "scheduled" && current !== "sent") map.set(r.letter_id, "queued");
    }
    return map;
  }, [emailRecords, statusById]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return letters
      .map((l) => ({ ...l, state: letterState.get(l.id) ?? ("never" as LetterState) }))
      .filter((l) => (filter === "all" ? true : l.state === filter))
      .filter((l) =>
        q
          ? l.archive_id.toLowerCase().includes(q) || (l.title ?? "").toLowerCase().includes(q)
          : true,
      );
  }, [letters, letterState, filter, search]);

  const counts = useMemo(() => {
    const c = { sent: 0, queued: 0, never: 0 };
    for (const l of letters) c[letterState.get(l.id) ?? "never"] += 1;
    return c;
  }, [letters, letterState]);

  const scheduleAt = selectedDay ? `${selectedDay}T09:00` : undefined;

  return (
    <AppShell>
      <PageHeader
        title="Email Admin"
        description="Schedule the next letter, see which records have gone out, and review every send."
      />
      <div className="space-y-6 px-4 py-6 sm:px-8">
        <Calendar
          emails={emails}
          recordsByEmail={recordsByEmail}
          selectedDay={selectedDay}
          onPickDay={(key) => setSelectedDay((prev) => (prev === key ? null : key))}
        />

        <section className="rounded-lg border border-border bg-card p-4">
          <header className="mb-3 flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h2 className="text-sm font-semibold">Letter coverage</h2>
              <p className="text-xs text-muted-foreground">
                {counts.never} never sent · {counts.queued} in queue · {counts.sent} sent
              </p>
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a record…"
              className="h-8 w-44"
            />
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </header>

          {selectedDay && (
            <p className="mb-2 rounded border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
              Scheduling for{" "}
              <strong>
                {new Date(`${selectedDay}T09:00`).toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </strong>{" "}
              at 9:00am — press Schedule on a letter below.{" "}
              <button className="underline" onClick={() => setSelectedDay(null)}>
                Clear
              </button>
            </p>
          )}

          <div className="max-h-[28rem] divide-y divide-border overflow-auto rounded border border-border">
            {rows.length === 0 && (
              <p className="px-3 py-6 text-sm text-muted-foreground">No records match.</p>
            )}
            {rows.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span
                  className={cn("size-2.5 shrink-0 rounded-full", DOT[l.state])}
                  title={DOT_LABEL[l.state]}
                  aria-label={DOT_LABEL[l.state]}
                />
                <span className="w-16 shrink-0 font-mono text-xs">{l.archive_id}</span>
                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                  {l.normalized_date ?? l.date_as_written ?? "—"}
                </span>
                <span className="truncate">{l.title ?? "Untitled"}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <EmailScratchpadButton
                    letterId={l.id}
                    archiveId={l.archive_id}
                    body={scratchpads[l.id]}
                  />
                  <EmailArchiveDialog
                    records={[{ kind: "letter", id: l.id, identifier: l.archive_id, title: l.title }]}
                    defaultSendAt={scheduleAt}
                    trigger={
                      <Button variant="outline" size="sm">
                        {scheduleAt ? "Schedule" : "Email"}
                      </Button>
                    }
                  />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Sent &amp; scheduled emails</h2>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && emails.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing sent yet. Open any record and choose Email to send one.
            </p>
          )}
          <div className="space-y-3">
            {emails.map((e) => (
              <details
                key={e.id}
                className="rounded-lg border border-border bg-card px-4 py-3 open:shadow-sm"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-xs ${
                      STATUS_STYLES[e.status] ?? STATUS_STYLES['sending']
                    }`}
                  >
                    {e.status}
                  </span>
                  <span className="font-medium">{e.subject}</span>
                  <span className="text-muted-foreground">
                    {(e.recipients ?? []).map((r) => r.email).join(", ")}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {e.status === "scheduled" && e.scheduled_for
                      ? `Sends ${new Date(e.scheduled_for).toLocaleString()}`
                      : new Date(e.sent_at).toLocaleString()}
                  </span>
                  {e.status === "scheduled" && (
                    <span
                      className="flex gap-2"
                      onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                      onKeyDown={(ev) => ev.stopPropagation()}
                    >
                      <EditScheduledEmailButton emailId={e.id} />
                      <AddRecipientsButton emailId={e.id} />
                      <CancelScheduledButton emailId={e.id} />
                    </span>
                  )}
                  <span
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                    }}
                  >
                    <GetEmailLinkButton emailId={e.id} />
                  </span>
                </summary>
                <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                  {e.message_body &&
                    (isRichHtml(e.message_body) ? (
                      <RichTextView html={e.message_body} />
                    ) : (
                      <p className="whitespace-pre-wrap">{e.message_body}</p>
                    ))}
                  {e.error && <p className="text-destructive">{e.error}</p>}
                  {(() => {
                    const recs = emailRecords
                      .filter((r) => r.email_id === e.id)
                      .map((r) => ({
                        kind: "letter" as const,
                        id: r.letter_id,
                        identifier: r.archive_id,
                      }));
                    return (
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {recs.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Records: {recs.map((r) => r.identifier).join(", ")}
                          </span>
                        )}
                        <EmailArchiveDialog
                          records={recs}
                          defaultSubject={e.subject}
                          defaultMessage={e.message_body ?? ""}
                          description="Send this same email again — add the new recipients below."
                          trigger={
                            <Button variant="outline" size="sm" className="gap-2">
                              <Send className="size-4" /> Send again
                            </Button>
                          }
                        />
                      </div>
                    );
                  })()}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
