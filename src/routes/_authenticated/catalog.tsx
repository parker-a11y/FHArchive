import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EditorOnly, AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { createRecord, previewNextArchiveId, type Letter } from "@/lib/queries";
import { DigitizationPanel } from "@/components/letter/DigitizationPanel";
import { FilePlus2, Printer } from "lucide-react";

import { StarNoteDialog } from "@/components/StarToggle";
import { FffBadge } from "@/components/FffBadge";
import { PostalFields } from "@/components/letter/PostalFields";
import {
  LocationLineDatalist,
  LocationLineNoneButton,
  LOCATION_LINE_LIST_ID,
} from "@/components/letter/LocationLineOptions";
import { ContainerSelect } from "@/components/containers/ContainerSelect";
import {
  DATE_CERTAINTY,
  DATE_PRECISION,
  IDENTIFICATION_STATUS,
  PERIODS,
  STORAGE_TYPES,
  isLetterType,
  labelDate,
} from "@/lib/archive";
import { EntryLabelDialog, labelLines, labelTitle } from "@/components/letter/LabelDialog";
import { PersonCombobox, usePeopleNames } from "@/components/PersonCombobox";
import { PersonRoleInput, type PersonRoleValue } from "@/components/PersonRoleInput";
import { linkLetterPeople } from "@/lib/letter-people";
import { isPersonalLetter, shortLetterTitle } from "@/lib/short-title";
import { CategorySelect } from "@/components/CategorySelect";
import { PhotoIntakeForm } from "@/components/photo/PhotoIntakeForm";
import { isPhotographType } from "@/components/photo/photo-fields";
import {
  addRecordType,
  addSubtype,
  useInvalidateCategories,
  useRecordTypeOptions,
  useSubtypeOptions,
} from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({
    meta: [
      { title: "Quick Entry — The Francis Files" },
      {
        name: "description",
        content:
          "Rapid keyboard-first intake screen that assigns the next sequential FH archive number to any item.",
      },
      { property: "og:title", content: "Quick Entry — The Francis Files" },
      {
        property: "og:description",
        content: "Fast intake of letters, photographs, military and family records with FH numbering.",
      },
    ],
  }),
  component: () => (
    <EditorOnly>
      <AppShell>
        <QuickEntry />
      </AppShell>
    </EditorOnly>
  ),
});

const blank = {
  record_type: "letter",
  subtype: "",
  title: "",
  date_as_written: "",
  dateline: "",
  normalized_date: "",
  date_end: "",
  date_precision: "exact",
  date_certainty: "confirmed",
  date_from_postmark: false,
  primary_person: "",
  tones: [] as string[],
  author: "",
  recipient: "",
  origin: "",
  destination: "",
  forwarded: false,
  forwarded_to: "",
  postal_service: "",
  postal_notes: "",
  censor_mark: false,
  period: "wartime",
  sheets: "",
  has_envelope: false,
  has_enclosures: false,
  starred: false,
  transcription_not_required: false,
  storage_type: "file_jacket",
  storage_folder: "",
  source_container_id: "",
  original_order_notes: "",
  identification_status: "identified",
  notes: "",
};

function Select_({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="field-label">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded border border-input bg-background px-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Storage choices are carried over between records for faster intake. */
const STORAGE_MEMORY_KEY = "fh.quickentry.storage";

type StorageMemory = {
  record_type: string;
  subtype: string;
  storage_type: string;
  source_container_id: string;
  original_order_notes: string;
};

function readLastStorage(): Partial<StorageMemory> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_MEMORY_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<StorageMemory>;
    return {
      record_type: p.record_type || "letter",
      subtype: p.subtype ?? "",
      storage_type: p.storage_type || "file_jacket",
      source_container_id: p.source_container_id ?? "",
      original_order_notes: p.original_order_notes ?? "",
    };
  } catch {
    return {};
  }
}

function rememberStorage(m: StorageMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_MEMORY_KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable — defaults still apply */
  }
}

/** Type + subtype are remembered as soon as they are chosen, not only on save. */
function rememberTypes(record_type: string, subtype: string) {
  rememberField({ record_type, subtype });
}

/** Persist any subset of the storage memory immediately, keeping the rest. */
function rememberField(patch: Partial<StorageMemory>) {
  const prev = readLastStorage();
  rememberStorage({
    record_type: prev.record_type || "letter",
    subtype: prev.subtype ?? "",
    storage_type: prev.storage_type || "file_jacket",
    source_container_id: prev.source_container_id ?? "",
    original_order_notes: prev.original_order_notes ?? "",
    ...patch,
  });
}

function QuickEntry() {
  const [next, setNext] = useState<{ fh_seq: number; archive_id: string } | null>(null);
  const [form, setForm] = useState({ ...blank });
  /** Set once "Start record" claims the FH number, so scans can be worked on here. */
  const [startedLetter, setStartedLetter] = useState<Letter | null>(null);
  const [starting, setStarting] = useState(false);

  const [authorPerson, setAuthorPerson] = useState<PersonRoleValue>(null);
  const [recipientPerson, setRecipientPerson] = useState<PersonRoleValue>(null);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<string[]>([]);
  const [starNoteFor, setStarNoteFor] = useState<string | null>(null);
  const [labelFor, setLabelFor] = useState<{ archiveId: string; date: string; title: string; lines: string[] } | null>(
    null,
  );
  const dateRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [titleError, setTitleError] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: people = [] } = usePeopleNames();

  async function loadNext() {
    try {
      const n = await previewNextArchiveId();
      setNext(n);
      // Folder / jacket defaults to the FH number; still editable.
      // Storage choices carry over from the last record entered.
      const remembered = readLastStorage();
      // Only apply remembered values that are non-empty so a blank memory
      // never wipes a selection already carried forward from the last save.
      const nonEmpty = Object.fromEntries(
        Object.entries(remembered).filter(([, v]) => v !== "" && v !== undefined && v !== null),
      );
      setForm((f) => ({ ...f, ...nonEmpty, storage_folder: n.archive_id }));
      setTimeout(() => dateRef.current?.focus(), 30);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    loadNext();
  }, []);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  function pickPerson(
    roleSetter: (p: PersonRoleValue) => void,
    fieldSetter: (v: string) => void,
    name: string,
  ) {
    const match = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (match) {
      roleSetter({ id: match.id, name: match.name });
      fieldSetter(match.name);
    } else {
      roleSetter(null);
      fieldSetter(name);
    }
  }
  const isLetter = isLetterType(form.record_type);
  const recordTypeOptions = useRecordTypeOptions();
  const subtypeOptions = useSubtypeOptions(form.record_type);
  const invalidateCategories = useInvalidateCategories();

  /** A date is never required: fall back to "undated" rather than blocking entry. */
  function datePrecision() {
    return !form.normalized_date &&
      !["undated", "not_applicable", "unknown"].includes(form.date_precision)
      ? "undated"
      : form.date_precision;
  }

  /** Core fields, shared by the create RPC and the update of a started record. */
  function coreArgs(precision: string) {
    return {
      p_record_type: form.record_type,
      p_subtype: form.subtype,
      p_title: form.title,
      p_date_as_written: form.date_as_written,
      p_dateline: form.dateline,
      p_normalized_date: form.normalized_date,
      p_date_end: form.date_end,
      p_date_precision: precision,
      p_date_certainty: form.date_certainty,
      p_primary_person: form.primary_person,
      p_author: isLetter ? form.author : null,
      p_recipient: isLetter ? form.recipient : null,
      p_origin: form.origin,
      p_destination: isLetter ? form.destination : null,
      p_period: form.period,
      p_sheets: form.sheets ? Number(form.sheets) : null,
      p_has_envelope: isLetter ? form.has_envelope : false,
      p_has_enclosures: form.has_enclosures,
      p_storage_location: null,
      p_original_copy: "original",
      p_notes: form.notes,
    };
  }

  function coreColumns(precision: string) {
    const a = coreArgs(precision);
    return {
      record_type: a.p_record_type,
      subtype: a.p_subtype || null,
      title: a.p_title || null,
      date_as_written: a.p_date_as_written || null,
      dateline: a.p_dateline || null,
      normalized_date: a.p_normalized_date || null,
      date_end: a.p_date_end || null,
      date_precision: a.p_date_precision,
      date_certainty: a.p_date_certainty,
      primary_person: a.p_primary_person || null,
      author: a.p_author || null,
      recipient: a.p_recipient || null,
      origin: a.p_origin || null,
      destination: a.p_destination || null,
      period: a.p_period,
      sheets: a.p_sheets,
      has_envelope: a.p_has_envelope,
      has_enclosures: a.p_has_enclosures,
      notes: a.p_notes || null,
    };
  }

  function extrasColumns() {
    return {
      identification_status: form.identification_status,
      date_from_postmark: form.date_from_postmark,
      forwarded: isLetter ? form.forwarded : false,
      forwarded_to: isLetter && form.forwarded ? form.forwarded_to || null : null,
      postal_service: isLetter ? form.postal_service || null : null,
      postal_notes: isLetter ? form.postal_notes || null : null,
      censor_mark: isLetter ? form.censor_mark : false,
      storage_type: form.storage_type || null,
      storage_folder: form.storage_folder || null,
      source_container_id: form.source_container_id || null,
      original_order_notes: form.original_order_notes || null,
      tones: form.tones,
      starred: form.starred,
      transcription_status: form.transcription_not_required ? "not_required" : "not_started",
    };
  }

  /**
   * Claims the FH number now so the full scan panel (thumbnails, naming,
   * rotation, viewer, confirm) can be used before the rest of the form is done.
   */
  async function startRecord() {
    if (starting || startedLetter) return;
    setStarting(true);
    try {
      const created = await createRecord(coreArgs(datePrecision()));
      await supabase.from("letters").update(extrasColumns() as never).eq("id", created.id);
      const { data, error } = await supabase
        .from("letters")
        .select("*")
        .eq("id", created.id)
        .single();
      if (error) throw error;
      setStartedLetter(data as unknown as Letter);
      qc.invalidateQueries({ queryKey: ["letters"] });
      toast.success(`${created.archive_id} started — add scans below`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  /** Title is required for every save/print path — highlight and focus when missing. */
  function requireTitle(): boolean {
    if (form.title.trim()) return true;
    setTitleError(true);
    toast.warning("Title / short description is required before saving", {
      description: "Give the record a short title — a few words is enough.",
    });
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  /** Print a label for what's on screen — saves first if the record doesn't exist yet. */
  function printLabel() {
    if (busy) return;
    if (!requireTitle()) return;
    if (startedLetter) {
      setLabelFor({
        archiveId: startedLetter.archive_id,
        date: labelDate({ ...form, date_precision: datePrecision() }),
        title: labelTitle({ title: form.title }),
        lines: labelLines({ ...form, sheets: form.sheets ? Number(form.sheets) : null }),
      });
    } else {
      void save("label");
    }
  }

  async function save(mode: "next" | "open" | "label") {
    if (busy) return;
    if (!requireTitle()) return;
    setBusy(true);
    const precision = datePrecision();
    let created: { id: string; archive_id: string };
    const followUpErrors: string[] = [];
    const extras = extrasColumns();
    if (startedLetter) {
      created = { id: startedLetter.id, archive_id: startedLetter.archive_id };
      const { error } = await supabase
        .from("letters")
        .update({ ...coreColumns(precision), ...extras } as never)
        .eq("id", created.id);
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
    } else {
      try {
        created = await createRecord(coreArgs(precision));
      } catch (e) {
        setBusy(false);
        return toast.error((e as Error).message);
      }
      const { error: extrasError } = await supabase
        .from("letters")
        .update(extras as never)
        .eq("id", created.id);
      if (extrasError) followUpErrors.push(`additional fields: ${extrasError.message}`);
    }

    try {
      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth.user?.id;
      if (ownerId) {
        const roleLinks: { personId: string; role: "author" | "recipient" | "mentioned" }[] = [];
        if (isLetter && authorPerson?.id) roleLinks.push({ personId: authorPerson.id, role: "author" });
        if (isLetter && recipientPerson?.id) roleLinks.push({ personId: recipientPerson.id, role: "recipient" });
        if (roleLinks.length) await linkLetterPeople(created.id, roleLinks, ownerId);
      }
    } catch (error) {
      followUpErrors.push(`people links: ${(error as Error).message}`);
    }

    setBusy(false);
    rememberStorage({
      record_type: form.record_type,
      subtype: form.subtype,
      storage_type: form.storage_type,
      source_container_id: form.source_container_id,
      original_order_notes: form.original_order_notes,
    });
    qc.invalidateQueries({ queryKey: ["letters"] });

    if (followUpErrors.length) {
      toast.warning(`${created.archive_id} was saved, but some details need attention`, {
        description: followUpErrors.join("; "),
        duration: 12000,
      });
    } else {
      toast.success(`${created.archive_id} cataloged`);
    }
    setSession((s) => [created.archive_id, ...s]);
    if (form.starred) {
      setStarNoteFor(`${created.archive_id}${form.title ? ` — ${form.title}` : ""}`);
    }
    if (mode === "open") {
      navigate({ to: "/letters/$archiveId", params: { archiveId: created.archive_id } });
      return;
    }
    if (mode === "label") {
      setLabelFor({
        archiveId: created.archive_id,
        date: labelDate({ ...form, date_precision: precision }),
        title: labelTitle({ title: form.title }),
        lines: labelLines({
          ...form,
          sheets: form.sheets ? Number(form.sheets) : null,
        }),
      });
    }
    setForm((f) => ({
      ...blank,
      record_type: f.record_type,
      subtype: f.subtype,
      period: f.period,
      primary_person: f.primary_person,
      storage_type: f.storage_type,
      storage_folder: f.storage_folder,
      source_container_id: f.source_container_id,
      author: isLetterType(f.record_type) ? f.author : "",
      recipient: isLetterType(f.record_type) ? f.recipient : "",
    }));
    setStartedLetter(null);
    // Preserve author/recipient people links for batch entry of similar records.
    setAuthorPerson((p) => (isLetterType(form.record_type) ? p : null));
    setRecipientPerson((p) => (isLetterType(form.record_type) ? p : null));
    loadNext();
  }



  return (
    <>
      <PageHeader
        title="Catalog Next Item"
        description="Type, date, a short description — then Save & Create Next (⌘/Ctrl + Enter). Details can be added later."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_16rem] gap-8 p-4 sm:p-8">
        {isPhotographType(form.record_type) ? (
        <PhotoIntakeForm
          nextArchiveId={next?.archive_id ?? null}
          recordType={form.record_type}
          onRecordTypeChange={(v) => setForm((f) => ({ ...f, record_type: v, subtype: "" }))}
          recordTypeOptions={recordTypeOptions}
          onSaved={(created, ctx) => {
            qc.invalidateQueries({ queryKey: ["letters"] });
            toast.success(`${created.archive_id} cataloged`);
            setSession((s) => [created.archive_id, ...s]);
            if (ctx.mode === "open") {
              navigate({ to: "/letters/$archiveId", params: { archiveId: created.archive_id } });
              return;
            }
            if (ctx.mode === "label") {
              setLabelFor({
                archiveId: created.archive_id,
                date: labelDate({ ...blank, normalized_date: ctx.date, date_precision: ctx.date ? "exact" : "undated" }),
                title: labelTitle({ title: ctx.title }),
                lines: labelLines({ ...blank, record_type: "photograph", title: ctx.title, sheets: null }),
              });
            }
            loadNext();
          }}
        />
        ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save("next");
          }}
          onKeyDown={(e) => {
            // Keyboard-first intake: hands never have to leave the keyboard.
            if (!(e.metaKey || e.ctrlKey)) return;
            if (e.key === "Enter") {
              e.preventDefault();
              save(e.shiftKey ? "open" : "next");
            } else if (e.key.toLowerCase() === "l") {
              e.preventDefault();
              save("label");
            }
          }}
        >
          <div className="mb-6 rounded border border-border bg-card px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="field-label">
                {startedLetter ? "Archive ID (record started)" : "Next archive ID (assigned on save)"}
              </div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">
                ⌘/Ctrl + ↵ save &amp; next · ⌘/Ctrl + ⇧ + ↵ save &amp; open · ⌘/Ctrl + L save &amp; label
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <div className="archive-id font-display text-4xl rounded-md border border-archive-gold/50 bg-archive-gold/10 px-3 py-1 text-archive-gold-strong shadow-sm">
                {startedLetter?.archive_id ?? next?.archive_id ?? "……"}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={printLabel} disabled={busy}>
                  <Printer className="mr-2 size-4" />
                  Print label
                </Button>
                {!startedLetter && (
                  <Button type="button" variant="outline" onClick={startRecord} disabled={starting}>
                    <FilePlus2 className="mr-2 size-4" />
                    {starting ? "Starting…" : "Start record & add scans"}
                  </Button>
                )}
              </div>
            </div>
            {!startedLetter && (
              <p className="mt-2 text-xs text-muted-foreground">
                Start the record to claim this number and work on its scans right here — thumbnails,
                names, rotation and the confirm step. Everything else keeps saving as usual.
              </p>
            )}
          </div>

          {startedLetter && (
            <div className="mb-6">
              <DigitizationPanel
                letter={{
                  ...startedLetter,
                  record_type: form.record_type,
                  sheets: form.sheets ? Number(form.sheets) : null,
                  has_envelope: isLetter ? form.has_envelope : false,
                }}
              />
            </div>
          )}





          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="field-label">Record type *</Label>
              <CategorySelect
                value={form.record_type}
                onChange={(v) => {
                  setForm((f) => ({ ...f, record_type: v, subtype: "" }));
                  rememberTypes(v, "");
                }}
                options={recordTypeOptions}
                onCreate={async (label) => {
                  const v = await addRecordType(label, recordTypeOptions);
                  invalidateCategories();
                  return v;
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Subtype</Label>
              <CategorySelect
                value={form.subtype}
                allowEmpty
                onChange={(v) => {
                  set("subtype", v);
                  rememberTypes(form.record_type, v);
                }}
                options={subtypeOptions.map((s) => ({ value: s, label: s }))}
                onCreate={async (label) => {
                  const v = await addSubtype(form.record_type, label, subtypeOptions);
                  invalidateCategories();
                  return v;
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">
                {form.date_precision === "year"
                  ? "Year (optional)"
                  : form.date_precision === "month"
                    ? "Month / year (optional)"
                    : "Date (optional)"}
              </Label>
              {form.date_precision === "year" ? (
                <Input
                  ref={dateRef}
                  type="number"
                  min={1700}
                  max={2100}
                  placeholder="e.g. 1944"
                  value={form.normalized_date ? form.normalized_date.slice(0, 4) : ""}
                  onChange={(e) => {
                    const y = e.target.value.replace(/\D/g, "").slice(0, 4);
                    set("normalized_date", y ? `${y}-01-01` : "");
                  }}
                />
              ) : form.date_precision === "month" ? (
                <Input
                  ref={dateRef}
                  type="month"
                  value={form.normalized_date ? form.normalized_date.slice(0, 7) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    set("normalized_date", v ? `${v}-01` : "");
                  }}
                />
              ) : (
                <Input
                  ref={dateRef}
                  type="date"
                  value={form.normalized_date}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((f) => ({
                      ...f,
                      normalized_date: value,
                      // A real date was entered — don't keep the record flagged undated.
                      date_precision:
                        value && (f.date_precision === "undated" || f.date_precision === "unknown")
                          ? "exact"
                          : f.date_precision,
                    }));
                  }}
                />
              )}

              <div className="flex gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={form.date_precision === "year"}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        date_precision: e.target.checked ? "year" : "exact",
                        normalized_date:
                          e.target.checked && f.normalized_date
                            ? `${f.normalized_date.slice(0, 4)}-01-01`
                            : f.normalized_date,
                      }))
                    }
                  />
                  Year only
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={form.date_precision === "month"}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        date_precision: e.target.checked ? "month" : "exact",
                        normalized_date:
                          e.target.checked && f.normalized_date
                            ? `${f.normalized_date.slice(0, 7)}-01`
                            : f.normalized_date,
                      }))
                    }
                  />
                  Month / year only
                </label>
              </div>
              <label className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={form.date_from_postmark}
                  onChange={(e) => set("date_from_postmark", e.target.checked)}
                />
                Date from postmark
              </label>
              <p className="text-[11px] text-muted-foreground">
                Leave blank — the record saves as Undated.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">End date (range, optional)</Label>
              <Input
                type="date"
                value={form.date_end}
                onChange={(e) => set("date_end", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Date as written</Label>
              <Input
                value={form.date_as_written}
                onChange={(e) => set("date_as_written", e.target.value)}
                placeholder="Mon. eve — June 14"
              />
              <div className="flex gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    set("date_as_written", "NONE");
                    if (!form.normalized_date) set("date_precision", "undated");
                  }}
                >
                  NONE
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Location Line (written at)</Label>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  list={LOCATION_LINE_LIST_ID}
                  value={form.dateline}
                  onChange={(e) => set("dateline", e.target.value)}
                />
                <LocationLineNoneButton onPick={(v) => set("dateline", v)} />
              </div>
              <LocationLineDatalist />
              <p className="text-[11px] text-muted-foreground">
                The place written on the letter itself — not the postmark. Use NONE when none
                is written.
              </p>
            </div>
            <Select_
              label="Date status"
              value={form.date_precision}
              onChange={(v) => set("date_precision", v)}
              options={DATE_PRECISION}
            />
            <Select_
              label="Certainty"
              value={form.date_certainty}
              onChange={(v) => set("date_certainty", v)}
              options={DATE_CERTAINTY}
            />
            <Select_
              label="Period"
              value={form.period}
              onChange={(v) => set("period", v)}
              options={PERIODS}
            />
            <Select_
              label="Identification status"
              value={form.identification_status}
              onChange={(v) => set("identification_status", v)}
              options={IDENTIFICATION_STATUS}
            />
            <div className="space-y-1.5">
              <Label className="field-label">Primary person</Label>
              <PersonCombobox
                value={form.primary_person}
                onChange={(v) => set("primary_person", v)}
              />
              <div className="flex gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => set("primary_person", "Francis A. Harrington")}
                >
                  Fran
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => set("primary_person", "Jaquelyn Harrington")}
                >
                  Jaq
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The single main subject of this record — add everyone else under People with roles.
              </p>
            </div>
            <div className="col-span-full space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="field-label">
                  Title / short description <span className="text-destructive">*</span>
                </Label>
                {isPersonalLetter(form.record_type, form.subtype) && (
                  <Button
                    type="button"
                    size="sm"
                    className="border border-archive-gold-strong bg-archive-gold font-semibold text-white shadow-sm hover:bg-archive-gold-strong"
                    onClick={() => {
                      set("title", shortLetterTitle(form));
                      setTitleError(false);
                    }}
                  >
                    Create Short Title
                  </Button>
                )}
              </div>
              <Input
                ref={titleRef}
                value={form.title}
                onChange={(e) => {
                  set("title", e.target.value);
                  if (titleError && e.target.value.trim()) setTitleError(false);
                }}
                placeholder="e.g. Discharge papers, Navy — or: portrait in dress blues"
                className={
                  titleError
                    ? "border-destructive ring-2 ring-destructive/40 focus-visible:ring-destructive"
                    : undefined
                }
              />
              {titleError && (
                <p className="text-xs font-medium text-destructive">
                  A title or short description is required — the record can't be saved without one.
                </p>
              )}
            </div>


            {isLetter && (
              <>
                <div className="space-y-1.5">
                  <Label className="field-label">From (sender)</Label>
                  <PersonRoleInput
                    value={authorPerson}
                    onChange={(person, name) => {
                      setAuthorPerson(person);
                      set("author", name);
                    }}
                    placeholder="Select or add sender…"
                  />
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() =>
                        pickPerson(setAuthorPerson, (v) => set("author", v), "Francis A. Harrington")
                      }
                    >
                      Fran
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() =>
                        pickPerson(setAuthorPerson, (v) => set("author", v), "Jaquelyn Harrington")
                      }
                    >
                      Jaq
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">To (recipient)</Label>
                  <PersonRoleInput
                    value={recipientPerson}
                    onChange={(person, name) => {
                      setRecipientPerson(person);
                      set("recipient", name);
                    }}
                    placeholder="Select or add recipient…"
                  />
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() =>
                        pickPerson(setRecipientPerson, (v) => set("recipient", v), "Francis A. Harrington")
                      }
                    >
                      Fran
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() =>
                        pickPerson(setRecipientPerson, (v) => set("recipient", v), "Jaquelyn Harrington")
                      }
                    >
                      Jaq
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">Mailing destination</Label>
                  <Input
                    value={form.destination}
                    onChange={(e) => set("destination", e.target.value)}
                    placeholder="Worcester, Massachusetts"
                  />
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => set("destination", "Worcester, Massachusetts")}
                    >
                      Worcester
                    </Button>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="field-label">{isLetter ? "Mailing origin" : "Location"}</Label>
              <Input
                value={form.origin}
                onChange={(e) => set("origin", e.target.value)}
                placeholder={isLetter ? "FPO San Francisco" : undefined}
              />
              {isLetter && (
                <div className="flex gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => set("origin", "FPO - San Francisco")}
                  >
                    FPO - San Francisco
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => set("origin", "Ft Schuyler")}
                  >
                    Ft Schuyler
                  </Button>
                </div>
              )}
            </div>
            {isLetter && (
              <PostalFields
                values={{
                  forwarded: form.forwarded,
                  forwarded_to: form.forwarded_to,
                  postal_service: form.postal_service,
                  postal_notes: form.postal_notes,
                  censor_mark: form.censor_mark,
                }}
                onChange={(k, v) => set(k as never, v as never)}
              />
            )}
            <div className="space-y-1.5">
              <Label className="field-label">Pages / sheets</Label>
              <Input
                type="number"
                min={0}
                value={form.sheets}
                onChange={(e) => set("sheets", e.target.value)}
              />
            </div>
            <div className="col-span-full rounded border border-border bg-card p-4">
              <div className="field-label mb-3">Physical storage location</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Select_
                  label="Storage type"
                  value={form.storage_type}
                  onChange={(v) => set("storage_type", v)}
                  options={STORAGE_TYPES}
                />
                {form.storage_type !== "digital_only" && (
                  <div className="space-y-1.5">
                    <Label className="field-label">Folder / jacket</Label>
                    <Input
                      value={form.storage_folder}
                      onChange={(e) => set("storage_folder", e.target.value)}
                      placeholder="FH-0268"
                    />
                  </div>
                )}
              </div>
              {form.storage_type === "digital_only" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Digital only — no physical item is stored.
                </p>
              )}
            </div>
            <div className="col-span-full rounded border border-border bg-card p-4">
              <div className="field-label mb-3">Original source container (provenance)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ContainerSelect
                  value={form.source_container_id}
                  onChange={(v) => {
                    set("source_container_id", v);
                    rememberField({ source_container_id: v });
                  }}
                />
                <div className="space-y-1.5">
                  <Label className="field-label">Original order / position notes</Label>
                  <Input
                    value={form.original_order_notes}
                    onChange={(e) => set("original_order_notes", e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-end gap-6 pb-2">
              {isLetter && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.has_envelope}
                    onChange={(e) => set("has_envelope", e.target.checked)}
                  />
                  Envelope
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.has_enclosures}
                  onChange={(e) => set("has_enclosures", e.target.checked)}
                />
                Enclosures
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.starred}
                  onChange={(e) => set("starred", e.target.checked)}
                />
                <FffBadge size={18} muted={!form.starred} />
                FFF — Francis File Find
              </label>
              <label
                className="flex items-center gap-2 text-sm"
                title="Artwork, objects, currency, photographs without meaningful text — no OCR/AI transcription needed."
              >
                <input
                  type="checkbox"
                  checked={form.transcription_not_required}
                  onChange={(e) => set("transcription_not_required", e.target.checked)}
                />
                Transcription / AI not required
              </label>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="field-label">Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
              SAVE &amp; CREATE NEXT
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={() => save("open")}
            >
              Save &amp; open record
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={() => save("label")}
            >
              Save &amp; print label
            </Button>
          </div>
        </form>
        )}

        <aside>
          <h2 className="field-label mb-2">
            This session{session.length > 0 ? ` — ${session.length}` : ""}
          </h2>
          <div className="rounded border border-border bg-card">
            {session.length === 0 && (
              <p className="px-3 py-3 text-xs text-muted-foreground">Nothing cataloged yet.</p>
            )}
            {session.map((id) => (
              <a
                key={id}
                href={`/letters/${id}`}
                className="archive-id block border-b border-border px-3 py-1.5 text-sm last:border-0 hover:bg-muted"
              >
                {id}
              </a>
            ))}
          </div>
        </aside>
      </div>

      <EntryLabelDialog
        key={labelFor?.archiveId ?? "none"}
        open={labelFor !== null}
        onOpenChange={(v) => {
          if (!v) setLabelFor(null);
        }}
        archiveId={labelFor?.archiveId ?? ""}
        defaultDate={labelFor?.date ?? ""}
        defaultTitle={labelFor?.title ?? ""}
        lines={labelFor?.lines ?? []}
      />

      <StarNoteDialog
        open={starNoteFor !== null}
        onOpenChange={(v) => {
          if (!v) setStarNoteFor(null);
        }}
        label={starNoteFor ?? ""}
      />
    </>
  );
}
