import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { addScheduledRecipients, cancelScheduledEmail, rescheduleEmails } from "@/lib/archive-email.functions";
import { useQueryClient } from "@tanstack/react-query";
import { RichTextView } from "@/components/RichTextView";
import { isRichHtml } from "@/lib/rich-text";
import {
  EmailScratchpadButton,
  fetchEmailScratchpads,
  SCRATCHPAD_QUERY_KEY,
} from "@/components/letter/EmailScratchpadButton";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  when: string;
  ids: string[];
  /** Every per-recipient copy of this dispatch on the day. */
  group?: { id: string; when: string }[];
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
        when,
        ids: recordsByEmail.get(e.id) ?? [],
      };
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [emails, recordsByEmail]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => new Date(year, month, i - firstWeekday + 1));

  const todayKey = localDayKey(today.toISOString());
  const qc = useQueryClient();
  const reschedule = useServerFn(rescheduleEmails);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const monthHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearMonthHover = () => {
    if (monthHoverTimer.current !== null) clearTimeout(monthHoverTimer.current);
    monthHoverTimer.current = null;
  };
  useEffect(() => () => clearMonthHover(), []);
  const hoverMonth = (ev: React.DragEvent, offset: number) => {
    if (!ev.dataTransfer.types.includes("application/x-archive-email") || moving) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    if (monthHoverTimer.current !== null) return;
    monthHoverTimer.current = setTimeout(() => {
      setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
      setDragOver(null);
      monthHoverTimer.current = null;
    }, 700);
  };

  const dropOn = async (key: string, raw: string) => {
    clearMonthHover();
    setDragOver(null);
    let group: { id: string; when: string }[] = [];
    try {
      group = JSON.parse(raw);
    } catch {
      return;
    }
    if (!group.length || localDayKey(group[0].when) === key) return;
    const moves = group.map((g) => {
      const old = new Date(g.when);
      const [y, m, d] = key.split("-").map(Number);
      const next = new Date(y, m - 1, d, old.getHours(), old.getMinutes(), 0, 0);
      return { emailId: g.id, scheduledFor: next.toISOString() };
    });
    if (new Date(moves[0].scheduledFor).getTime() < Date.now() + 60_000)
      return toast.error("You can only move an email to a future day.");
    const taken = (byDay.get(key) ?? []).some((e) => e.kind === "scheduled");
    if (taken && !window.confirm("That day already has an email scheduled. Move it there anyway?"))
      return;
    setMoving(true);
    try {
      await reschedule({ data: { moves } });
      await qc.invalidateQueries();
      toast.success(
        `Moved to ${new Date(moves[0].scheduledFor).toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Dispatch calendar</h2>
          <p className="text-xs text-muted-foreground">
            Tap a day to see its email, or schedule one. Drag a blue email to another day to move it.
            {moving && " Moving…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            onDragOver={(ev) => hoverMonth(ev, -1)}
            onDragLeave={clearMonthHover}
            onDrop={(ev) => { ev.preventDefault(); clearMonthHover(); }}
            title="Previous month — hold a dragged email here to change months"
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
            onDragOver={(ev) => hoverMonth(ev, 1)}
            onDragLeave={clearMonthHover}
            onDrop={(ev) => { ev.preventDefault(); clearMonthHover(); }}
            title="Next month — hold a dragged email here to change months"
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
        {cells.map((date) => {
          const day = date.getDate();
          const outsideMonth = date.getMonth() !== month;
          const key = localDayKey(date.toISOString());
          // One email per recipient means the same dispatch repeats — show it once.
          const all = byDay.get(key) ?? [];
          const seen = new Set<string>();
          const groups = new Map<string, { id: string; when: string }[]>();
          for (const e of all) {
            const sig = `${e.kind}|${e.ids.join(",")}|${e.subject}`;
            groups.set(sig, [...(groups.get(sig) ?? []), { id: e.emailId, when: e.when }]);
          }
          const unique = all
            .filter((e) => {
              const sig = `${e.kind}|${e.ids.join(",")}|${e.subject}`;
              if (seen.has(sig)) return false;
              seen.add(sig);
              return true;
            })
            .map((e) => ({ ...e, group: groups.get(`${e.kind}|${e.ids.join(",")}|${e.subject}`) }));
          const entries = unique.slice(0, 3);
          const extra = unique.length - entries.length;
          const empty = entries.length === 0;
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          return (
            <button
              key={key}
              type="button"
              aria-label={date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
              onClick={() => onPickDay(key)}
              onDragOver={(ev) => {
                if (!ev.dataTransfer.types.includes("application/x-archive-email")) return;
                ev.preventDefault();
                setDragOver(key);
              }}
              onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
              onDrop={(ev) => {
                ev.preventDefault();
                dropOn(key, ev.dataTransfer.getData("application/x-archive-email"));
              }}
              className={cn(
                dragOver === key && "ring-2 ring-sky-500 bg-sky-500/10",
                "min-h-16 rounded border p-1 text-left text-[11px] transition-colors",
                outsideMonth && "text-muted-foreground bg-muted/30",
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
                {outsideMonth && day === 1 ? date.toLocaleDateString([], { month: "short", day: "numeric" }) : day}
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
                  draggable={e.kind === "scheduled"}
                  onDragStart={(ev) => {
                    ev.stopPropagation();
                    ev.dataTransfer.effectAllowed = "move";
                    ev.dataTransfer.setData(
                      "application/x-archive-email",
                      JSON.stringify(e.group ?? [{ id: e.emailId, when: e.when }]),
                    );
                  }}
                  onDragEnd={() => { clearMonthHover(); setDragOver(null); }}
                  className={cn(
                    "mt-1 hidden truncate rounded px-1 py-0.5 sm:block",
                    e.kind === "scheduled" && "cursor-grab active:cursor-grabbing",
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

  const [recipientLookup, setRecipientLookup] = useState("");
  const recipientQuery = recipientLookup.trim().toLowerCase();
  const recipientEmails = useMemo(() => {
    if (recipientQuery.length < 3) return [];
    return emails.filter((e) =>
      (e.recipients ?? []).some((r) => (r.email ?? "").toLowerCase().includes(recipientQuery)),
    );
  }, [recipientQuery, emails]);

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
    const logged = emailRecords.filter((r) => r.email_id === e.id);
    // Queued emails have no logged records yet — use the ones saved with the send.
    const refs: { kind: "letter" | "source"; id: string }[] = logged.length
      ? logged.map((r) => ({ kind: "letter" as const, id: r.letter_id }))
      : (e.send_payload?.records ?? []);
    const recs = refs.map((r) => {
      const l = r.kind === "letter" ? letters.find((x) => x.id === r.id) : undefined;
      const loggedRow = logged.find((x) => x.letter_id === r.id);
      return {
        kind: r.kind,
        id: r.id,
        identifier: loggedRow?.archive_id ?? l?.archive_id ?? "",
        title: l?.title ?? null,
        date: l?.normalized_date ?? null,
      };
    });
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
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Has this record been emailed?</h2>
          <Input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="Type an archive number, e.g. 428 or FH0428"
            className="mt-2 h-9 max-w-sm"
            inputMode="text"
          />
          {lookupId && (
            <div className="mt-3 space-y-3">
              <p className="text-sm">
                <strong className="font-mono">{lookupId}</strong>{" "}
                {lookupEmails.length === 0
                  ? "has never been used in an email."
                  : `appears in ${lookupEmails.length} email${lookupEmails.length === 1 ? "" : "s"}:`}
              </p>
              {lookupEmails.map((e) => renderEmail(e))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">What has been sent to this person?</h2>
          <Input
            value={recipientLookup}
            onChange={(e) => setRecipientLookup(e.target.value)}
            placeholder="Type an email address or part of one"
            className="mt-2 h-9 max-w-sm"
            type="email"
            list={CONTACT_EMAIL_LIST_ID}
          />
          <ContactEmailList />
          {recipientQuery.length >= 3 && (
            <div className="mt-3 space-y-3">
              <p className="text-sm">
                {recipientEmails.length === 0
                  ? "No emails found for that address."
                  : `${recipientEmails.length} email${recipientEmails.length === 1 ? "" : "s"} to ${recipientQuery}:`}
              </p>
              {recipientEmails.map((e) => renderEmail(e))}
            </div>
          )}
        </section>

        <Calendar
          emails={emails}
          recordsByEmail={recordsByEmail}
          selectedDay={selectedDay}
          onPickDay={(key) => setSheetDay(key)}
        />

        <section id="letter-coverage" className="rounded-lg border border-border bg-card p-4">
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
                    records={[{ kind: "letter", id: l.id, identifier: l.archive_id, title: l.title, date: l.normalized_date }]}
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
          <div className="space-y-3">{emails.map((e) => renderEmail(e))}</div>
        </section>
      </div>

      <Sheet open={!!sheetDay} onOpenChange={(o) => !o && setSheetDay(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>
              {sheetDay &&
                new Date(`${sheetDay}T12:00`).toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 py-4">
            {sheetEmails.length === 0 && (
              <p className="text-sm text-muted-foreground">No letter scheduled for this date.</p>
            )}
            {sheetEmails.map((e) => renderEmail(e, true))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSelectedDay(sheetDay);
                setSheetDay(null);
                document.getElementById("letter-coverage")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Schedule a letter for this day
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
