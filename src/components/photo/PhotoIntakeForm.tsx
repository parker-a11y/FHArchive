/**
 * Photograph intake — deliberately minimal: front image, optional back image,
 * writing on the back, title, date, people pictured, place and storage box.
 * Everything else can be filled in later on the record page.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategorySelect } from "@/components/CategorySelect";
import { PersonMultiSelect, type PersonRef } from "@/components/PersonMultiSelect";
import { StorageLocationSelect } from "@/components/letter/StorageLocationSelect";
import { supabase } from "@/integrations/supabase/client";
import { createRecord } from "@/lib/queries";
import { linkLetterPeople } from "@/lib/letter-people";
import { addRecordType, useInvalidateCategories, type Option } from "@/lib/categories";
import { findOrCreatePlace, uploadPhotoAtIntake } from "./photo-fields";

export type PhotoSaveMode = "next" | "open" | "label";

type Props = {
  nextArchiveId: string | null;
  recordType: string;
  onRecordTypeChange?: (v: string) => void;
  recordTypeOptions?: Option[];
  /** Pre-filled images (e.g. picked from the Unassigned Photos bucket). */
  initialFront?: File | null;
  initialBack?: File | null;
  onSaved: (
    created: { id: string; archive_id: string },
    ctx: { mode: PhotoSaveMode; title: string; date: string; starred: boolean },
  ) => void | Promise<void>;
};

const blank = {
  title: "",
  normalized_date: "",
  date_precision: "exact",
  date_certainty: "confirmed",
  back_inscription: "",
  place: "",
  storage_location: "",
};

function ImageDrop({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div>
      <div className="field-label mb-1">{label}</div>
      <input
        ref={ref}
        type="file"
        accept="image/*,.tif,.tiff,application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => e.key === " " && ref.current?.click()}
        className="flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/30 text-center hover:border-primary"
      >
        {preview ? (
          <img src={preview} alt={label} className="h-full w-full object-contain" />
        ) : (
          <div className="px-3 text-xs text-muted-foreground">
            <ImagePlus className="mx-auto mb-1 size-5" />
            Drop or click
          </div>
        )}
      </div>
      {file && (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => onFile(null)} aria-label={`Remove ${label}`}>
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function PhotoIntakeForm({
  nextArchiveId,
  recordType,
  onRecordTypeChange,
  recordTypeOptions,
  initialFront = null,
  initialBack = null,
  onSaved,
}: Props) {
  const [form, setForm] = useState({ ...blank });
  const [people, setPeople] = useState<PersonRef[]>([]);
  const [front, setFront] = useState<File | null>(initialFront);
  const [back, setBack] = useState<File | null>(initialBack);
  const [busy, setBusy] = useState(false);
  const invalidateCategories = useInvalidateCategories();
  const set = (k: keyof typeof blank, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => setFront(initialFront), [initialFront]);
  useEffect(() => setBack(initialBack), [initialBack]);

  async function save(mode: PhotoSaveMode) {
    if (busy) return;
    setBusy(true);
    try {
      const precision = !form.normalized_date ? "undated" : form.date_precision;
      const writing = form.back_inscription.trim();
      const created = await createRecord({
        p_record_type: recordType,
        p_subtype: "",
        p_title: form.title,
        p_date_as_written: "",
        p_normalized_date: form.normalized_date,
        p_date_end: "",
        p_date_precision: precision,
        p_date_certainty: form.date_certainty,
        p_primary_person: "",
        p_author: null,
        p_recipient: null,
        p_origin: null,
        p_destination: null,
        p_period: "wartime",
        p_sheets: null,
        p_has_envelope: false,
        p_has_enclosures: false,
        p_storage_location: form.storage_location || null,
        p_original_copy: "original",
        p_notes: "",
      });

      await supabase
        .from("letters")
        .update({
          photo_back_inscription: writing || null,
          storage_location: form.storage_location || null,
          storage_type: "photo_sleeve",
          photo_front_scanned: !!front,
          photo_back_scanned: !!back,
          transcription_status: writing || back ? "not_started" : "not_required",
        } as never)
        .eq("id", created.id);

      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.id && people.length) {
        await linkLetterPeople(
          created.id,
          people.map((p) => ({ personId: p.id, role: "pictured" as never })),
          auth.user.id,
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

      for (const [file, seq, label] of [
        [front, 1, "Front"],
        [back, 2, "Back"],
      ] as const) {
        if (!file) continue;
        try {
          await uploadPhotoAtIntake(created.archive_id, created.id, file, seq, label);
        } catch (e) {
          toast.error(`${created.archive_id}: ${label.toLowerCase()} upload failed — ${(e as Error).message}`, {
            duration: 10000,
          });
        }
      }

      await onSaved(created, { mode, title: form.title, date: form.normalized_date, starred: false });
      if (mode !== "open") {
        setForm((f) => ({ ...blank, storage_location: f.storage_location }));
        setPeople([]);
        setFront(null);
        setBack(null);
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
      <div className="mb-5 flex flex-wrap items-end gap-6">
        <div className="rounded border border-border bg-card px-5 py-3">
          <div className="field-label">Next archive ID</div>
          <div className="archive-id font-display text-3xl">{nextArchiveId ?? "……"}</div>
        </div>
        {onRecordTypeChange && recordTypeOptions && (
          <div className="w-56 space-y-1.5">
            <Label className="field-label">Record type</Label>
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
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[20rem_1fr]">
        <div className="grid grid-cols-2 gap-3">
          <ImageDrop label="Front" file={front} onFile={setFront} />
          <ImageDrop label="Back (optional)" file={back} onFile={setBack} />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="field-label">Title</Label>
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Fran and Skip on the dock"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="field-label">Date</Label>
            <Input
              type="date"
              className="max-w-xs"
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
                  onChange={(e) => set("date_certainty", e.target.checked ? "approximate" : "confirmed")}
                />
                Approximate
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="field-label">Writing on back</Label>
            <Textarea
              rows={3}
              value={form.back_inscription}
              onChange={(e) => set("back_inscription", e.target.value)}
              placeholder="Type exactly what's written on the back, if anything"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="field-label">People pictured</Label>
            <PersonMultiSelect
              value={people}
              onAdd={(p) => setPeople((m) => (m.some((x) => x.id === p.id) ? m : [...m, p]))}
              onRemove={(p) => setPeople((m) => m.filter((x) => x.id !== p.id))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="field-label">Place</Label>
              <Input value={form.place} onChange={(e) => set("place", e.target.value)} />
            </div>
            <StorageLocationSelect
              label="Box"
              value={form.storage_location}
              onChange={(v) => set("storage_location", v)}
            />
          </div>
        </div>
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
