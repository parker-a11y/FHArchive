/**
 * Envelope Review — an admin-only catch-up workspace.
 *
 * Walks through records that already have envelope scans so the mailing and
 * postal details can be filled in quickly, one envelope at a time, without
 * touching the normal intake flow.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, RotateCw } from "lucide-react";
import { AdminOnly, AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchDigitalFiles, type DigitalFileWithDerivatives } from "@/lib/digital-files";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostalFields, type PostalValues } from "@/components/letter/PostalFields";
import { displayDate } from "@/lib/archive";

type EnvelopeRecord = {
  id: string;
  archive_id: string;
  title: string | null;
  date_as_written: string | null;
  normalized_date: string | null;
  origin: string | null;
  destination: string | null;
  forwarded: boolean;
  forwarded_to: string | null;
  postal_service: string | null;
  postal_notes: string | null;
};

const isEnvelope = (f: { label: string | null; original_filename: string }) =>
  /envelope/i.test(`${f.label ?? ""} ${f.original_filename}`);

const isBack = (f: { label: string | null; original_filename: string }) =>
  /back|reverse|rear/i.test(`${f.label ?? ""} ${f.original_filename}`);

async function fetchEnvelopeRecords(): Promise<EnvelopeRecord[]> {
  const { data: files, error: fErr } = await supabase
    .from("digital_files")
    .select("letter_id, label, original_filename");
  if (fErr) throw fErr;

  const ids = Array.from(
    new Set((files ?? []).filter(isEnvelope).map((f) => f.letter_id as string)),
  );
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("letters")
    .select(
      "id, archive_id, title, date_as_written, normalized_date, origin, destination, forwarded, forwarded_to, postal_service, postal_notes",
    )
    .in("id", ids)
    .order("archive_id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EnvelopeRecord[];
}

export const Route = createFileRoute("/_authenticated/envelopes")({
  head: () => ({
    meta: [
      { title: "Envelope Review — The Francis Files" },
      {
        name: "description",
        content:
          "Review scanned envelopes record by record and fill in mailing origin, destination, postage and forwarding details.",
      },
      { property: "og:title", content: "Envelope Review — The Francis Files" },
      {
        property: "og:description",
        content: "A fast, focused pass through every envelope in the archive.",
      },
    ],
  }),
  component: () => (
    <AdminOnly>
      <AppShell>
        <EnvelopeReview />
      </AppShell>
    </AdminOnly>
  ),
});

const emptyPostal: PostalValues = {
  forwarded: false,
  forwarded_to: "",
  postal_service: "",
  postal_notes: "",
};

function needsReview(r: EnvelopeRecord) {
  return !r.postal_service || !r.origin || !r.destination;
}

function EnvelopeReview() {
  const qc = useQueryClient();
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["envelope-records"],
    queryFn: fetchEnvelopeRecords,
  });

  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [side, setSide] = useState<"front" | "back">("front");
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [postal, setPostal] = useState<PostalValues>(emptyPostal);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  const list = useMemo(
    () => (onlyNeedsReview ? records.filter(needsReview) : records),
    [records, onlyNeedsReview],
  );

  const index = list.findIndex((r) => r.id === selectedId);
  const current = index >= 0 ? list[index] : undefined;

  // Keep a valid selection as the list/filter changes.
  useEffect(() => {
    if (!list.length) {
      setSelectedId(null);
      return;
    }
    if (!list.some((r) => r.id === selectedId)) setSelectedId(list[0].id);
  }, [list, selectedId]);

  // Load the selected record's fields into the form.
  useEffect(() => {
    if (!current) return;
    setPostal({
      forwarded: !!current.forwarded,
      forwarded_to: current.forwarded_to ?? "",
      postal_service: current.postal_service ?? "",
      postal_notes: current.postal_notes ?? "",
    });
    setSide("front");
    setRotation(0);
    setZoomed(false);
  }, [current?.id]);

  const { data: files = [] } = useQuery({
    queryKey: ["envelope-files", current?.id],
    queryFn: () => fetchDigitalFiles(current!.id),
    enabled: !!current?.id,
  });

  const envelopes = files.filter(isEnvelope) as DigitalFileWithDerivatives[];
  const front = envelopes.find((f) => !isBack(f)) ?? envelopes[0];
  const back = envelopes.find((f) => isBack(f));
  const shown = side === "back" ? (back ?? front) : front;

  const go = (delta: number) => {
    const next = list[index + delta];
    if (next) setSelectedId(next.id);
  };

  const save = async (advance: boolean) => {
    if (!current) return;
    setSaving(true);
    try {
      // These two inputs are intentionally uncontrolled. Reading their native
      // values avoids mobile input/composition timing replacing typed text
      // with stale React state when Save is tapped.
      const visibleOrigin = originInputRef.current?.value ?? "";
      const visibleDestination = destinationInputRef.current?.value ?? "";
      const payload = {
        origin: visibleOrigin.trim() || null,
        destination: visibleDestination.trim() || null,
        forwarded: postal.forwarded,
        forwarded_to: postal.forwarded ? postal.forwarded_to.trim() || null : null,
        postal_service: postal.postal_service || null,
        postal_notes: postal.postal_notes.trim() || null,
      };
      const { data, error } = await supabase
        .from("letters")
        .update(payload as never)
        .eq("id", current.id)
        .select("id, origin, destination, postal_service")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Nothing was saved — you may not have permission to edit this record.");
      if ((data.origin ?? null) !== payload.origin || (data.destination ?? null) !== payload.destination) {
        throw new Error("Mailing origin/destination did not persist. Please try again.");
      }
      toast.success(`${current.archive_id} saved`);
      await qc.invalidateQueries({ queryKey: ["envelope-records"] });
      await qc.invalidateQueries({ queryKey: ["letters"] });
      await qc.invalidateQueries({ queryKey: ["letter", current.archive_id] });
      if (advance) go(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };


  return (
    <>
      <PageHeader
        title="Envelope Review"
        description="Work through scanned envelopes and complete the mailing and postal details."
        actions={
          <Button
            variant={onlyNeedsReview ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyNeedsReview((v) => !v)}
          >
            Needs review only
          </Button>
        }
      />

      <div className="grid gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-lg border border-border">
          <div className="border-b border-border px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {list.length} record{list.length === 1 ? "" : "s"} with envelopes
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-1">
            {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && !list.length && (
              <p className="p-3 text-sm text-muted-foreground">Nothing to review.</p>
            )}
            {list.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  r.id === selectedId ? "bg-accent font-medium" : "hover:bg-accent/50"
                }`}
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    needsReview(r) ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-xs">{r.archive_id}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.title || r.date_as_written || "Untitled"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {current ? (
          <section className="min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" disabled={index <= 0} onClick={() => go(-1)}>
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <div className="text-sm">
                <span className="font-mono font-medium">{current.archive_id}</span>
                <span className="ml-2 text-muted-foreground">
                  {index + 1} of {list.length}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={index >= list.length - 1}
                onClick={() => go(1)}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={side === "front" ? "default" : "outline"}
                    onClick={() => {
                      setSide("front");
                      setRotation(0);
                    }}
                  >
                    Front
                  </Button>
                  <Button
                    size="sm"
                    variant={side === "back" ? "default" : "outline"}
                    disabled={!back}
                    onClick={() => {
                      setSide("back");
                      setRotation(0);
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    aria-label="Rotate view"
                  >
                    <RotateCw className="size-4" />
                  </Button>
                </div>
                <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-2">
                  {shown?.viewUrl ? (
                    <button
                      type="button"
                      onClick={() => setZoomed(true)}
                      className="cursor-zoom-in"
                      aria-label="Enlarge envelope scan"
                    >
                      <img
                        src={shown.viewUrl}
                        alt={shown.label ?? "Envelope scan"}
                        style={{ transform: `rotate(${rotation}deg)` }}
                        className="max-h-[62vh] w-auto object-contain transition-transform"
                      />
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground">No viewable envelope scan.</p>
                  )}
                </div>
                <Dialog open={zoomed} onOpenChange={setZoomed}>
                  <DialogContent className="max-w-5xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        {current.archive_id} — {shown?.label ?? "Envelope"}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRotation((r) => (r + 90) % 360)}
                          aria-label="Rotate view"
                        >
                          <RotateCw className="size-4" />
                        </Button>
                      </DialogTitle>
                    </DialogHeader>
                    {shown?.viewUrl && (
                      <div className="flex max-h-[70vh] items-center justify-center overflow-auto">
                        <img
                          src={shown.viewUrl}
                          alt={shown.label ?? "Envelope scan"}
                          style={{ transform: `rotate(${rotation}deg)` }}
                          className="max-h-[70vh] w-auto object-contain transition-transform"
                        />
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => setZoomed(false)}>
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {shown?.label && (
                  <p className="text-center text-xs text-muted-foreground">{shown.label}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="field-label">Mailing origin</Label>
                    <Input
                      key={`origin-${current.id}`}
                      ref={originInputRef}
                      name="mailing-origin"
                      defaultValue={current.origin ?? ""}
                      placeholder="FPO San Francisco"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="field-label">Mailing destination</Label>
                    <Input
                      key={`destination-${current.id}`}
                      ref={destinationInputRef}
                      name="mailing-destination"
                      defaultValue={current.destination ?? ""}
                      placeholder="Worcester, Massachusetts"
                    />
                  </div>
                </div>

                <div className="grid gap-4">
                  <PostalFields
                    values={postal}
                    onChange={(key, value) =>
                      setPostal((p) => ({ ...p, [key]: value }) as PostalValues)
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={() => save(true)} disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin" />} Save & next
                  </Button>
                  <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Select a record to review its envelope.
          </section>
        )}
      </div>
    </>
  );
}
