import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createLetter, previewNextArchiveId } from "@/lib/queries";
import { DATE_CERTAINTY, DATE_PRECISION, PERIODS } from "@/lib/archive";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Quick Entry — Harrington Letter Archive" },
      {
        name: "description",
        content:
          "Rapid keyboard-first cataloging screen that assigns the next sequential FH archive number.",
      },
      { property: "og:title", content: "Quick Entry — Harrington Letter Archive" },
      {
        property: "og:description",
        content: "Rapid cataloging of letters with automatic sequential FH numbering.",
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
  date_as_written: "",
  normalized_date: "",
  date_precision: "exact",
  date_certainty: "confirmed",
  author: "",
  recipient: "",
  origin: "",
  destination: "",
  period: "wartime",
  sheets: "",
  has_envelope: false,
  has_enclosures: false,
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

  async function save(andNext: boolean) {
    if (busy) return;
    setBusy(true);
    let created: { archive_id: string };
    try {
      created = await createLetter({
        p_date_as_written: form.date_as_written || null,
        p_normalized_date: form.normalized_date || null,
        p_date_precision: form.date_precision,
        p_date_certainty: form.date_certainty,
        p_author: form.author || null,
        p_recipient: form.recipient || null,
        p_origin: form.origin || null,
        p_destination: form.destination || null,
        p_period: form.period,
        p_sheets: form.sheets ? Number(form.sheets) : null,
        p_has_envelope: form.has_envelope,
        p_has_enclosures: form.has_enclosures,
        p_notes: form.notes || null,
      });
    } catch (e) {
      setBusy(false);
      return toast.error((e as Error).message);
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["letters"] });
    toast.success(`${created.archive_id} cataloged`);
    setSession((s) => [created.archive_id, ...s]);
    if (andNext) {
      setForm((f) => ({ ...blank, period: f.period, author: f.author, recipient: f.recipient }));
      loadNext();
    } else {
      navigate({ to: "/letters/$archiveId", params: { archiveId: created.archive_id } });
    }
  }


  return (
    <>
      <PageHeader
        title="Catalog Next Letter"
        description="Enter the basics, then Save & Create Next (⌘/Ctrl + Enter)."
      />
      <div className="grid grid-cols-[1fr_16rem] gap-8 p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              save(true);
            }
          }}
        >
          <div className="mb-6 rounded border border-border bg-card px-5 py-4">
            <div className="field-label">Assigning archive ID</div>
            <div className="archive-id font-display mt-1 text-4xl">
              {next?.archive_id ?? "……"}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="field-label">Date (normalized)</Label>
              <Input
                ref={dateRef}
                type="date"
                value={form.normalized_date}
                onChange={(e) => set("normalized_date", e.target.value)}
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
              label="Precision"
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
            <div className="space-y-1.5">
              <Label className="field-label">From (author)</Label>
              <Input value={form.author} onChange={(e) => set("author", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">To (recipient)</Label>
              <Input value={form.recipient} onChange={(e) => set("recipient", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Origin</Label>
              <Input value={form.origin} onChange={(e) => set("origin", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Destination</Label>
              <Input
                value={form.destination}
                onChange={(e) => set("destination", e.target.value)}
              />
            </div>
            <Select_
              label="Period"
              value={form.period}
              onChange={(v) => set("period", v)}
              options={PERIODS}
            />
            <div className="space-y-1.5">
              <Label className="field-label">Sheets</Label>
              <Input
                type="number"
                min={0}
                value={form.sheets}
                onChange={(e) => set("sheets", e.target.value)}
              />
            </div>
            <div className="flex items-end gap-6 pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.has_envelope}
                  onChange={(e) => set("has_envelope", e.target.checked)}
                />
                Envelope
              </label>
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

          <div className="mt-6 flex gap-3">
            <Button type="submit" size="lg" disabled={busy || !next}>
              SAVE &amp; CREATE NEXT
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => save(false)}>
              Save &amp; open record
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
    </>
  );
}
