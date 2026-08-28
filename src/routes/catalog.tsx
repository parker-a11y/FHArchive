import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { createRecord, previewNextArchiveId } from "@/lib/queries";
import {
  DATE_CERTAINTY,
  DATE_PRECISION,
  IDENTIFICATION_STATUS,
  ORIGINAL_COPY,
  PERIODS,
  RECORD_TYPES,
  STORAGE_TYPES,
  isLetterType,
  labelDate,
  subtypesFor,
} from "@/lib/archive";
import { EntryLabelDialog, labelLines } from "@/components/letter/LabelDialog";
import { PersonCombobox } from "@/components/PersonCombobox";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Quick Entry — Harrington Family Archive" },
      {
        name: "description",
        content:
          "Rapid keyboard-first intake screen that assigns the next sequential FH archive number to any item.",
      },
      { property: "og:title", content: "Quick Entry — Harrington Family Archive" },
      {
        property: "og:description",
        content: "Fast intake of letters, photographs, military and family records with FH numbering.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <QuickEntry />
    </AppShell>
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
  author: "",
  recipient: "",
  origin: "",
  destination: "",
  period: "wartime",
  sheets: "",
  has_envelope: false,
  has_enclosures: false,
  storage_location: "",
  storage_type: "",
  storage_container: "",
  storage_folder: "",
  storage_position: "",
  storage_notes: "",
  identification_status: "unidentified",
  original_copy: "original",
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
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<string[]>([]);
  const [labelFor, setLabelFor] = useState<{ archiveId: string; date: string; lines: string[] } | null>(
    null,
  );
  const dateRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function loadNext() {
    try {
      setNext(await previewNextArchiveId());
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
        p_storage_location: form.storage_location,
        p_original_copy: form.original_copy,
        p_notes: form.notes,
      });
      const extras = {
        identification_status: form.identification_status,
        storage_type: form.storage_type || null,
        storage_container: form.storage_container || null,
        storage_folder: form.storage_folder || null,
        storage_position: form.storage_position || null,
        storage_notes: form.storage_notes || null,
      };
      await supabase.from("letters").update(extras as never).eq("id", created.id);
    } catch (e) {
      setBusy(false);
      return toast.error((e as Error).message);
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["letters"] });
    toast.success(`${created.archive_id} cataloged`);
    setSession((s) => [created.archive_id, ...s]);
    if (mode === "open") {
      navigate({ to: "/letters/$archiveId", params: { archiveId: created.archive_id } });
      return;
    }
    if (mode === "label") {
      setLabelFor({
        archiveId: created.archive_id,
        date: labelDate({ ...form, date_precision: precision }),
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
      storage_location: f.storage_location,
      storage_type: f.storage_type,
      storage_container: f.storage_container,
      storage_folder: f.storage_folder,
      storage_position: f.storage_position,
      original_copy: f.original_copy,
      author: isLetterType(f.record_type) ? f.author : "",
      recipient: isLetterType(f.record_type) ? f.recipient : "",
    }));
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
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              save("next");
            }
          }}
        >
          <div className="mb-6 rounded border border-border bg-card px-5 py-4">
            <div className="field-label">Next archive ID (assigned on save)</div>
            <div className="archive-id font-display mt-1 text-4xl">
              {next?.archive_id ?? "……"}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select_
              label="Record type *"
              value={form.record_type}
              onChange={(v) => setForm((f) => ({ ...f, record_type: v, subtype: "" }))}
              options={RECORD_TYPES}
            />
            <div className="space-y-1.5">
              <Label className="field-label">Subtype</Label>
              <select
                value={form.subtype}
                onChange={(e) => set("subtype", e.target.value)}
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
              >
                <option value="">—</option>
                {subtypesFor(form.record_type).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Primary person</Label>
              <PersonCombobox
                value={form.primary_person}
                onChange={(v) => set("primary_person", v)}
              />
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
              <Label className="field-label">Date (optional)</Label>
              <Input
                ref={dateRef}
                type="date"
                value={form.normalized_date}
                onChange={(e) => set("normalized_date", e.target.value)}
              />
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
                  <Input value={form.author} onChange={(e) => set("author", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">To (recipient)</Label>
                  <Input
                    value={form.recipient}
                    onChange={(e) => set("recipient", e.target.value)}
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
            <Select_
              label="Original / copy"
              value={form.original_copy}
              onChange={(v) => set("original_copy", v)}
              options={ORIGINAL_COPY}
            />
            <div className="space-y-1.5">
              <Label className="field-label">Legacy storage note</Label>
              <Input
                value={form.storage_location}
                onChange={(e) => set("storage_location", e.target.value)}
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
                  <Label className="field-label">Container / box</Label>
                  <Input
                    value={form.storage_container}
                    onChange={(e) => set("storage_container", e.target.value)}
                    placeholder="Artifact Box 01"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">Folder / jacket</Label>
                  <Input
                    value={form.storage_folder}
                    onChange={(e) => set("storage_folder", e.target.value)}
                    placeholder="FH-0268"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="field-label">Position / compartment</Label>
                  <Input
                    value={form.storage_position}
                    onChange={(e) => set("storage_position", e.target.value)}
                    placeholder="Compartment 07"
                  />
                </div>
                <div className="col-span-full space-y-1.5">
                  <Label className="field-label">Location notes</Label>
                  <Input
                    value={form.storage_notes}
                    onChange={(e) => set("storage_notes", e.target.value)}
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
          <h2 className="field-label mb-2">This session</h2>
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
        open={labelFor !== null}
        onOpenChange={(v) => {
          if (!v) setLabelFor(null);
        }}
        archiveId={labelFor?.archiveId ?? ""}
        defaultDate={labelFor?.date ?? ""}
        lines={labelFor?.lines ?? []}
      />
    </>
  );
}
