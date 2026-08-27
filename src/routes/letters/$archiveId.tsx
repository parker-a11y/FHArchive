import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteLetter,
  fetchLetterByArchiveId,
  fetchLetters,
  logEdits,
  type Letter,
} from "@/lib/queries";

import {
  DATE_CERTAINTY,
  DATE_PRECISION,
  PERIODS,
  PUBLICATION_STATUS,
  REVIEW_STATUS,
  SCAN_STATUS,
  displayDate,
} from "@/lib/archive";
import { ScansPanel } from "@/components/letter/ScansPanel";
import { LabelDialog } from "@/components/letter/LabelDialog";
import { TranscriptionPanel } from "@/components/letter/TranscriptionPanel";
import {
  AiPanel,
  HistoryPanel,
  LinksPanel,
  ReferencesPanel,
  RelationsPanel,
} from "@/components/letter/ResearchPanels";

export const Route = createFileRoute("/letters/$archiveId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.archiveId} — Harrington Letter Archive` },
      {
        name: "description",
        content: `Archival record ${params.archiveId}: catalog metadata, scans, transcription, keywords and research notes.`,
      },
      { property: "og:title", content: `${params.archiveId} — Harrington Letter Archive` },
      {
        property: "og:description",
        content: `Archival record ${params.archiveId} with scans, transcription and research notes.`,
      },
    ],
  }),
  component: () => (
    <AppShell>
      <LetterPage />
    </AppShell>
  ),
});

const TEXT_FIELDS = [
  { key: "date_as_written", label: "Date as written" },
  { key: "author", label: "Author (from)" },
  { key: "recipient", label: "Recipient (to)" },
  { key: "origin", label: "Origin — written from" },
  { key: "destination", label: "Destination" },
  { key: "physical_condition", label: "Physical condition" },
];

function LetterPage() {
  const { archiveId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: letter, isLoading } = useQuery({
    queryKey: ["letter", archiveId],
    queryFn: () => fetchLetterByArchiveId(archiveId),
  });
  const { data: all = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });

  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);


  useEffect(() => {
    if (!letter) return;
    setForm({
      date_as_written: letter.date_as_written ?? "",
      normalized_date: letter.normalized_date ?? "",
      date_precision: letter.date_precision,
      date_certainty: letter.date_certainty,
      author: letter.author ?? "",
      recipient: letter.recipient ?? "",
      origin: letter.origin ?? "",
      destination: letter.destination ?? "",
      period: letter.period,
      sheets: letter.sheets === null ? "" : String(letter.sheets),
      has_envelope: letter.has_envelope,
      has_enclosures: letter.has_enclosures,
      physical_condition: letter.physical_condition ?? "",
      notes: letter.notes ?? "",
      summary_short: letter.summary_short ?? "",
      summary_long: letter.summary_long ?? "",
      review_status: letter.review_status,
      scan_status: letter.scan_status,
      publication_status: letter.publication_status,
      research_needed: letter.research_needed,
    });
    setDirty(false);
  }, [letter]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!letter)
    return (
      <div className="p-8">
        <p className="text-sm">No record found for {archiveId}.</p>
        <Link to="/letters" className="text-sm text-primary underline">
          Back to letters
        </Link>
      </div>
    );

  const set = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  async function save() {
    if (!letter) return;
    const payload: Record<string, unknown> = {
      ...form,
      normalized_date: form.normalized_date || null,
      sheets: form.sheets ? Number(form.sheets) : null,
    };
    for (const k of Object.keys(payload)) {
      if (payload[k] === "") payload[k] = null;
    }
    payload.date_precision = form.date_precision;
    payload.date_certainty = form.date_certainty;
    payload.period = form.period;
    payload.review_status = form.review_status;
    payload.scan_status = form.scan_status;
    payload.publication_status = form.publication_status;

    const { error } = await supabase.from("letters").update(payload as never).eq("id", letter.id);
    if (error) return toast.error(error.message);
    await logEdits(letter.id, letter as unknown as Record<string, unknown>, payload);
    qc.invalidateQueries({ queryKey: ["letter", archiveId] });
    qc.invalidateQueries({ queryKey: ["letters"] });
    qc.invalidateQueries({ queryKey: ["history", letter.id] });
    setDirty(false);
    toast.success("Record saved — changes recorded in edit history");
  }

  const bySeq = [...all].sort((a, b) => a.fh_seq - b.fh_seq);
  const idx = bySeq.findIndex((l) => l.id === letter.id);
  const prev = bySeq[idx - 1];
  const next = bySeq[idx + 1];

  const byDate = [...all].sort((a, b) =>
    (a.normalized_date ?? "9999").localeCompare(b.normalized_date ?? "9999"),
  );
  const cIdx = byDate.findIndex((l) => l.id === letter.id);
  const cPrev = byDate[cIdx - 1];
  const cNext = byDate[cIdx + 1];

  const Nav = ({ target, children }: { target?: Letter; children: React.ReactNode }) =>
    target ? (
      <Link
        to="/letters/$archiveId"
        params={{ archiveId: target.archive_id }}
        className="text-sm text-primary hover:underline"
      >
        {children}
      </Link>
    ) : (
      <span className="text-sm text-muted-foreground/50">{children}</span>
    );

  return (
    <>
      <header className="no-print border-b border-border px-8 py-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="archive-id font-display text-5xl leading-none">{letter.archive_id}</div>
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <span>
                <span className="field-label mr-2">Date</span>
                {displayDate(letter)}
              </span>
              <span>
                <span className="field-label mr-2">From</span>
                {letter.author || "—"}
              </span>
              <span>
                <span className="field-label mr-2">To</span>
                {letter.recipient || "—"}
              </span>
              <span>
                <span className="field-label mr-2">Origin</span>
                {letter.origin || "—"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LabelDialog letter={letter} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1.5 size-4" />
                  Delete record
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {letter.archive_id}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the record, its scans, links, and edit history. If{" "}
                    {letter.archive_id} is the most recently issued number, it will be reused for
                    your next entry. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleting}
                    onClick={async (e) => {
                      e.preventDefault();
                      setDeleting(true);
                      try {
                        const reused = await deleteLetter(letter);
                        await qc.invalidateQueries();
                        toast.success(
                          reused
                            ? `${letter.archive_id} deleted — number will be reused`
                            : `${letter.archive_id} deleted`,
                        );
                        navigate({ to: "/letters" });
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setDeleting(false);
                      }
                    }}
                  >
                    {deleting ? "Deleting…" : "Delete permanently"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={save} disabled={!dirty}>
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>

        </div>

        <div className="mt-4 flex items-center gap-6 border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <Nav target={prev}>
              <ChevronLeft className="mr-1 inline size-3.5" />
              {prev ? prev.archive_id : "Previous"}
            </Nav>
            <span className="archive-id text-sm">{letter.archive_id}</span>
            <Nav target={next}>
              {next ? next.archive_id : "Next"}
              <ChevronRight className="ml-1 inline size-3.5" />
            </Nav>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="field-label">Chronological</span>
            <Nav target={cPrev}>← Previous</Nav>
            <Nav target={cNext}>Next →</Nav>
          </div>
        </div>
      </header>

      <Tabs defaultValue="catalog" className="px-8 py-6">
        <TabsList className="no-print">
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="scans">Scans ({letter.image_count})</TabsTrigger>
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
          <TabsTrigger value="links">People · Places · Keywords</TabsTrigger>
          <TabsTrigger value="references">Research</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="ai">AI Analysis</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6">
          <div className="grid max-w-5xl grid-cols-3 gap-4">
            <div>
              <label className="field-label">Normalized date</label>
              <Input
                type="date"
                value={(form.normalized_date as string) ?? ""}
                onChange={(e) => set("normalized_date", e.target.value)}
              />
            </div>
            {TEXT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="field-label">{f.label}</label>
                <Input
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </div>
            ))}
            {[
              { key: "date_precision", label: "Date precision", opts: DATE_PRECISION },
              { key: "date_certainty", label: "Date certainty", opts: DATE_CERTAINTY },
              { key: "period", label: "Period", opts: PERIODS },
              { key: "scan_status", label: "Scan status", opts: SCAN_STATUS },
              { key: "review_status", label: "Review status", opts: REVIEW_STATUS },
              { key: "publication_status", label: "Publication status", opts: PUBLICATION_STATUS },
            ].map((f) => (
              <div key={f.key}>
                <label className="field-label">{f.label}</label>
                <select
                  className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  {f.opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div>
              <label className="field-label">Physical sheets</label>
              <Input
                type="number"
                min={0}
                value={(form.sheets as string) ?? ""}
                onChange={(e) => set("sheets", e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Scanned images</label>
              <Input value={letter.image_count} readOnly className="bg-muted" />
            </div>
            <div className="flex items-end gap-6 pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.has_envelope}
                  onChange={(e) => set("has_envelope", e.target.checked)}
                />
                Envelope
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.has_enclosures}
                  onChange={(e) => set("has_enclosures", e.target.checked)}
                />
                Enclosures
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.research_needed}
                  onChange={(e) => set("research_needed", e.target.checked)}
                />
                Research needed
              </label>
            </div>
            <div className="col-span-3">
              <label className="field-label">General notes (my interpretation / research)</label>
              <Textarea
                rows={4}
                value={(form.notes as string) ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            <div className="col-span-3 grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Short summary</label>
                <Textarea
                  rows={3}
                  value={(form.summary_short as string) ?? ""}
                  onChange={(e) => set("summary_short", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Detailed summary</label>
                <Textarea
                  rows={3}
                  value={(form.summary_long as string) ?? ""}
                  onChange={(e) => set("summary_long", e.target.value)}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scans" className="mt-6">
          <ScansPanel letter={letter} />
        </TabsContent>
        <TabsContent value="transcription" className="mt-6">
          <TranscriptionPanel letter={letter} />
        </TabsContent>
        <TabsContent value="links" className="mt-6">
          <LinksPanel letter={letter} />
        </TabsContent>
        <TabsContent value="references" className="mt-6">
          <ReferencesPanel letter={letter} />
        </TabsContent>
        <TabsContent value="related" className="mt-6">
          <RelationsPanel letter={letter} />
        </TabsContent>
        <TabsContent value="ai" className="mt-6">
          <AiPanel letter={letter} />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <HistoryPanel letter={letter} />
        </TabsContent>
      </Tabs>
      <div className="px-8 pb-10 text-xs text-muted-foreground">
        Record created {new Date(letter.created_at).toLocaleDateString()} · modified{" "}
        {new Date(letter.updated_at).toLocaleDateString()} ·{" "}
        <button className="underline" onClick={() => navigate({ to: "/letters" })}>
          back to table
        </button>
      </div>
    </>
  );
}
