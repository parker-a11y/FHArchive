/**
 * Photograph intake — an image-first alternative to the document form.
 *
 * Only the handful of fields that a photograph actually carries are shown;
 * everything letter-specific (sender/recipient, postal, envelope, sheets) is
 * gone. Optional sections stay collapsed so a fast pass touches four fields.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategorySelect } from "@/components/CategorySelect";
import { PersonMultiSelect, type PersonRef } from "@/components/PersonMultiSelect";
import { PersonCombobox } from "@/components/PersonCombobox";
import { ContainerSelect } from "@/components/containers/ContainerSelect";
import { supabase } from "@/integrations/supabase/client";
import { createRecord } from "@/lib/queries";
import { linkLetterPeople } from "@/lib/letter-people";
import { STORAGE_TYPES } from "@/lib/archive";
import {
  addRecordType,
  addSubtype,
  useInvalidateCategories,
  useSubtypeOptions,
  type Option,
} from "@/lib/categories";
import { PHOTO_MEDIUMS, findOrCreatePlace, uploadPhotoAtIntake } from "./photo-fields";

export type PhotoSaveMode = "next" | "open" | "label";

type Props = {
  nextArchiveId: string | null;
  recordType: string;
  onRecordTypeChange: (v: string) => void;
  recordTypeOptions: Option[];
  onSaved: (created: { id: string; archive_id: string }, ctx: { mode: PhotoSaveMode; title: string; date: string; starred: boolean }) => void;
};

const blank = {
  subtype: "",
  title: "",
  normalized_date: "",
  date_precision: "exact",
  date_certainty: "confirmed",
  occasion: "",
  place: "",
  photographer: "",
  print_size: "",
  photo_medium: "",
  has_writing: false,
  back_inscription: "",
  storage_type: "photo_sleeve",
  storage_folder: "",
  source_container_id: "",
  primary_person: "",
  notes: "",
};

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-muted/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {title}
      </button>
      {open && <div className="grid grid-cols-1 gap-3 border-t border-border px-3 py-3 sm:grid-cols-3">{children}</div>}
    </div>
  );
}

export function PhotoIntakeForm({
  nextArchiveId,
  recordType,
  onRecordTypeChange,
  recordTypeOptions,
  onSaved,
}: Props) {
  const [form, setForm] = useState({ ...blank });
  const [people, setPeople] = useState<PersonRef[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState({ details: false, writing: false, storage: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const subtypeOptions = useSubtypeOptions(recordType);
  const invalidateCategories = useInvalidateCategories();

  const set = (k: keyof typeof blank, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (nextArchiveId) setForm((f) => (f.storage_folder ? f : { ...f, storage_folder: nextArchiveId }));
  }, [nextArchiveId]);

  async function save(mode: PhotoSaveMode) {
    if (busy) return;
    setBusy(true);
    try {
      const precision = !form.normalized_date ? "undated" : form.date_precision;
      const created = await createRecord({
        p_record_type: recordType,
        p_subtype: form.subtype,
        p_title: form.title,
        p_date_as_written: "",
        p_normalized_date: form.normalized_date,
        p_date_end: "",
        p_date_precision: precision,
        p_date_certainty: form.date_certainty,
        p_primary_person: form.primary_person,
        p_author: null,
        p_recipient: null,
        p_origin: null,
        p_destination: null,
        p_period: "wartime",
        p_sheets: null,
        p_has_envelope: false,
        p_has_enclosures: false,
        p_storage_location: null,
        p_original_copy: "original",
        p_notes: form.notes,
      });

      await supabase
        .from("letters")
        .update({
          photo_occasion: form.occasion || null,
          photographer: form.photographer || null,
          print_size: form.print_size || null,
          photo_medium: form.photo_medium || null,
          photo_back_inscription: form.has_writing ? form.back_inscription || null : null,
          storage_type: form.storage_type || null,
          storage_folder: form.storage_folder || null,
          source_container_id: form.source_container_id || null,
          // Photographs skip transcription unless the print carries writing.
          transcription_status: form.has_writing ? "not_started" : "not_required",
        } as never)
        .eq("id", created.id);

      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth.user?.id;
      if (ownerId && people.length) {
        await linkLetterPeople(
          created.id,
          people.map((p) => ({ personId: p.id, role: "pictured" as never })),
          ownerId,
        );
      }
      if (form.place.trim()) {
        try {
          const placeId = await findOrCreatePlace(form.place);
          if (placeId)
            await supabase
              .from("letter_places")
              .insert({ letter_id: created.id, place_id: placeId, role: "depicted" } as never);
        } catch (e) {
          toast.error(`Place not linked — ${(e as Error).message}`);
        }
      }

      if (file) {
        try {
          await uploadPhotoAtIntake(created.archive_id, created.id, file);
        } catch (e) {
          toast.error(`${created.archive_id}: photo upload failed — ${(e as Error).message}`, {
            duration: 10000,
          });
        }
      }

      onSaved(created, {
        mode,
        title: form.title,
        date: form.normalized_date,
        starred: false,
      });
      if (mode !== "open") {
        setForm((f) => ({
          ...blank,
          subtype: f.subtype,
          storage_type: f.storage_type,
          source_container_id: f.source_container_id,
          storage_folder: "",
        }));
        setPeople([]);
        setFile(null);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save("next");
      }}
      onKeyDown={(e) => {
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
        <div className="field-label">Next archive ID (assigned on save)</div>
        <div className="archive-id font-display mt-1 text-4xl">{nextArchiveId ?? "……"}</div>
      </div>

      <div className="mb-4 max-w-xs space-y-1.5">
        <Label className="field-label">Record type *</Label>
        <CategorySelect
          value={recordType}
          onChange={onRecordTypeChange}
          options={recordTypeOptions}
          onCreate={async (label) => {
            const v = await addRecordType(label, recordTypeOptions);
            invalidateCategories();
            return v;
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[18rem_1fr]">
        {/* ------------------------------ image ------------------------------ */}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.tif,.tiff,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/30 text-center"
          >
            {preview ? (
              <img src={preview} alt="Photograph preview" className="h-full w-full object-contain" />
            ) : (
              <div className="px-4 text-sm text-muted-foreground">
                <ImagePlus className="mx-auto mb-2 size-6" />
                Drop the photo here, or click to choose
              </div>
            )}
          </div>
          {file && (
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="Remove photo">
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* ------------------------------ core ------------------------------ */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="field-label">Subtype</Label>
            <div className="flex flex-wrap gap-1.5">
              {subtypeOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("subtype", form.subtype === s ? "" : s)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    form.subtype === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary"
                  }`}
                >
                  {s}
                </button>
              ))}
              <div className="w-40">
                <CategorySelect
                  value=""
                  allowEmpty
                  className="h-7 text-xs"
                  onChange={(v) => set("subtype", v)}
                  options={subtypeOptions.map((s) => ({ value: s, label: s }))}
                  onCreate={async (label) => {
                    const v = await addSubtype(recordType, label, subtypeOptions);
                    invalidateCategories();
                    return v;
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="field-label">Caption / short description</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="field-label">Date (optional)</Label>
              <Input
                type="date"
                value={form.normalized_date}
                onChange={(e) => set("normalized_date", e.target.value)}
              />
              <div className="flex flex-wrap gap-4 pt-1 text-xs">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.date_precision === "year"}
                    onChange={(e) => set("date_precision", e.target.checked ? "year" : "exact")}
                  />
                  Year only
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.date_certainty === "approximate"}
                    onChange={(e) =>
                      set("date_certainty", e.target.checked ? "approximate" : "confirmed")
                    }
                  />
                  Approximate
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Place</Label>
              <Input value={form.place} onChange={(e) => set("place", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="field-label">People pictured</Label>
            <PersonMultiSelect
              value={people}
              onAdd={(p) => setPeople((m) => (m.some((x) => x.id === p.id) ? m : [...m, p]))}
              onRemove={(p) => setPeople((m) => m.filter((x) => x.id !== p.id))}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="field-label">Occasion / event</Label>
            <Input value={form.occasion} onChange={(e) => set("occasion", e.target.value)} />
          </div>
        </div>
      </div>

      {/* --------------------------- optional bits --------------------------- */}
      <div className="mt-5 space-y-2">
        <Section
          title="Photo details"
          open={open.details}
          onToggle={() => setOpen((o) => ({ ...o, details: !o.details }))}
        >
          <div className="space-y-1.5">
            <Label className="field-label">Photographer / studio</Label>
            <Input value={form.photographer} onChange={(e) => set("photographer", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="field-label">Print size</Label>
            <Input value={form.print_size} onChange={(e) => set("print_size", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="field-label">Black &amp; white or color</Label>
            <select
              value={form.photo_medium}
              onChange={(e) => set("photo_medium", e.target.value)}
              className="h-9 w-full rounded border border-input bg-background px-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {PHOTO_MEDIUMS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="field-label">Primary person (optional)</Label>
            <PersonCombobox
              value={form.primary_person}
              onChange={(v) => set("primary_person", v)}
            />
          </div>
        </Section>

        <Section
          title="Writing on the back"
          open={open.writing}
          onToggle={() => setOpen((o) => ({ ...o, writing: !o.writing }))}
        >
          <label className="flex items-start gap-2 text-sm sm:col-span-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.has_writing}
              onChange={(e) => set("has_writing", e.target.checked)}
            />
            <span className="leading-snug">
              This photo has writing on it — keep transcription / AI review on for this record.
            </span>
          </label>
          {form.has_writing && (
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="field-label">Reverse inscription</Label>
              <Textarea
                rows={3}
                value={form.back_inscription}
                onChange={(e) => set("back_inscription", e.target.value)}
              />
            </div>
          )}
        </Section>

        <Section
          title="Storage &amp; filing"
          open={open.storage}
          onToggle={() => setOpen((o) => ({ ...o, storage: !o.storage }))}
        >
          <div className="space-y-1.5">
            <Label className="field-label">Storage type</Label>
            <select
              value={form.storage_type}
              onChange={(e) => set("storage_type", e.target.value)}
              className="h-9 w-full rounded border border-input bg-background px-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {STORAGE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="field-label">Folder / jacket</Label>
            <Input
              value={form.storage_folder}
              onChange={(e) => set("storage_folder", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="field-label">Source container</Label>
            <ContainerSelect
              value={form.source_container_id}
              onChange={(v) => set("source_container_id", v)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="field-label">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </Section>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save & next"}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => save("open")}>
          Save &amp; open
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => save("label")}>
          Save &amp; label
        </Button>
      </div>
    </form>
  );
}
