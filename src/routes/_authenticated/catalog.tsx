import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminOnly, AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { createRecord, previewNextArchiveId } from "@/lib/queries";
import { RelatedRecordsField, type PendingRelation } from "@/components/RelatedRecordsPanel";
import { addRecordLink } from "@/lib/record-links";
import { StarNoteDialog } from "@/components/StarToggle";
import { FffBadge } from "@/components/FffBadge";
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
import { PersonCombobox } from "@/components/PersonCombobox";
import { PersonMultiSelect, type PersonRef } from "@/components/PersonMultiSelect";
import { PersonRoleInput, type PersonRoleValue } from "@/components/PersonRoleInput";
import { linkLetterPeople } from "@/lib/letter-people";
import { ToneMultiSelect } from "@/components/ToneMultiSelect";
import { CategorySelect } from "@/components/CategorySelect";
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
    <AdminOnly>
      <AppShell>
        <QuickEntry />
      </AppShell>
    </AdminOnly>
  ),
});

const blank = {
  record_type: "letter",
  subtype: "",
  title: "",
  date_as_written: "",
  normalized_date: "",
  date_end: "",
  date_precision: "exact",
  date_certainty: "confirmed",
  primary_person: "",
  tones: [] as string[],
  author: "",
  recipient: "",
  origin: "",
  destination: "",
  period: "wartime",
  sheets: "",
  has_envelope: false,
  has_enclosures: false,
  starred: false,
  transcription_not_required: false,
  storage_type: "",
  storage_folder: "",
  source_container_id: "",
  original_order_notes: "",
  identification_status: "",
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

function QuickEntry() {
  const [next, setNext] = useState<{ fh_seq: number; archive_id: string } | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [mentions, setMentions] = useState<PersonRef[]>([]);
  const [relations, setRelations] = useState<PendingRelation[]>([]);
  const [authorPerson, setAuthorPerson] = useState<PersonRoleValue>(null);
  const [recipientPerson, setRecipientPerson] = useState<PersonRoleValue>(null);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<string[]>([]);
  const [starNoteFor, setStarNoteFor] = useState<string | null>(null);
  const [labelFor, setLabelFor] = useState<{ archiveId: string; date: string; title: string; lines: string[] } | null>(
    null,
  );
  const dateRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function loadNext() {
    try {
      const n = await previewNextArchiveId();
      setNext(n);
      // Folder / jacket defaults to the FH number; still editable.
      setForm((f) => ({ ...f, storage_folder: n.archive_id }));
      setTimeout(() => dateRef.current?.focus(), 30);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    loadNext();
  }, []);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const isLetter = isLetterType(form.record_type);
  const recordTypeOptions = useRecordTypeOptions();
  const subtypeOptions = useSubtypeOptions(form.record_type);
  const invalidateCategories = useInvalidateCategories();

  async function save(mode: "next" | "open" | "label") {
    if (busy) return;
    setBusy(true);
    // A record never needs a date: fall back to "undated" rather than blocking entry.
    const precision =
      !form.normalized_date && !["undated", "not_applicable", "unknown"].includes(form.date_precision)
        ? "undated"
        : form.date_precision;
    let created: { id: string; archive_id: string };
    try {
      created = await createRecord({
        p_record_type: form.record_type,
        p_subtype: form.subtype,
        p_title: form.title,
        p_date_as_written: form.date_as_written,
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
      });
      const extras = {
        identification_status: form.identification_status,
        storage_type: form.storage_type || null,
        storage_folder: form.storage_folder || null,
        source_container_id: form.source_container_id || null,
        original_order_notes: form.original_order_notes || null,
        tones: form.tones,
        starred: form.starred,
        transcription_status: form.transcription_not_required ? "not_required" : "not_started",
      };
      await supabase.from("letters").update(extras as never).eq("id", created.id);
      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth.user?.id;
      if (ownerId) {
        const roleLinks: { personId: string; role: "author" | "recipient" | "mentioned" }[] = [];
        if (isLetter && authorPerson?.id) roleLinks.push({ personId: authorPerson.id, role: "author" });
        if (isLetter && recipientPerson?.id) roleLinks.push({ personId: recipientPerson.id, role: "recipient" });
        if (mentions.length) {
          for (const p of mentions) roleLinks.push({ personId: p.id, role: "mentioned" });
        }
        if (roleLinks.length) {
          await linkLetterPeople(created.id, roleLinks, ownerId);
        }
      }
      // Cross-references are intellectual links only — provenance untouched.
      for (const r of relations) {
        try {
          await addRecordLink(
            { kind: "letter", id: created.id },
            { kind: r.record.kind, id: r.record.id },
            r.note,
          );
        } catch (err) {
          toast.error(`Could not link ${r.record.ref}: ${(err as Error).message}`);
        }
      }
    } catch (e) {
      setBusy(false);
      return toast.error((e as Error).message);
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["letters"] });
    toast.success(`${created.archive_id} cataloged`);
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
    setMentions([]);
    setRelations([]);
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
              <div className="field-label">Next archive ID (assigned on save)</div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">
                ⌘/Ctrl + ↵ save &amp; next · ⌘/Ctrl + ⇧ + ↵ save &amp; open · ⌘/Ctrl + L save &amp; label
              </div>
            </div>
            <div className="archive-id font-display mt-1 text-4xl">
              {next?.archive_id ?? "……"}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="field-label">Record type *</Label>
              <CategorySelect
                value={form.record_type}
                onChange={(v) => setForm((f) => ({ ...f, record_type: v, subtype: "" }))}
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
                onChange={(v) => set("subtype", v)}
                options={subtypeOptions.map((s) => ({ value: s, label: s }))}
                onCreate={async (label) => {
                  const v = await addSubtype(form.record_type, label, subtypeOptions);
                  invalidateCategories();
                  return v;
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Primary person</Label>
              <PersonCombobox
                value={form.primary_person}
                onChange={(v) => set("primary_person", v)}
              />
              <p className="text-xs text-muted-foreground">
                The single main subject of this record — add everyone else under People with roles.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Mentions</Label>
              <PersonMultiSelect
                value={mentions}
                onAdd={(p) => setMentions((m) => (m.some((x) => x.id === p.id) ? m : [...m, p]))}
                onRemove={(p) => setMentions((m) => m.filter((x) => x.id !== p.id))}
              />
              <p className="text-xs text-muted-foreground">
                Other people named in this record — linked as “mentioned”.
              </p>
            </div>
            <div className="col-span-full space-y-1.5">
              <Label className="field-label">Related records (optional)</Label>
              <RelatedRecordsField value={relations} onChange={setRelations} />
              <p className="text-xs text-muted-foreground">
                Historical connections to any other archive record — physical or digital. Links
                work both ways and do not affect provenance or storage.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Tone / sentiment (optional)</Label>
              <ToneMultiSelect value={form.tones} onChange={(v) => set("tones", v)} />
            </div>

            <div className="col-span-full space-y-1.5">
              <Label className="field-label">Title / short description</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Discharge papers, Navy — or: portrait in dress blues"
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
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">Destination</Label>
                  <Input
                    value={form.destination}
                    onChange={(e) => set("destination", e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="field-label">{isLetter ? "Origin" : "Location"}</Label>
              <Input value={form.origin} onChange={(e) => set("origin", e.target.value)} />
            </div>
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
                <div className="space-y-1.5">
                  <Label className="field-label">Folder / jacket</Label>
                  <Input
                    value={form.storage_folder}
                    onChange={(e) => set("storage_folder", e.target.value)}
                    placeholder="FH-0268"
                  />
                </div>
              </div>
            </div>
            <div className="col-span-full rounded border border-border bg-card p-4">
              <div className="field-label mb-3">Original source container (provenance)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ContainerSelect
                  value={form.source_container_id}
                  onChange={(v) => set("source_container_id", v)}
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
