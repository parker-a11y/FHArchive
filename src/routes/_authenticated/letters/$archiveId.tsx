import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CategorySelect } from "@/components/CategorySelect";
import {
  addRecordType,
  addSubtype,
  useInvalidateCategories,
  useRecordTypeOptions,
  useSubtypeOptions,
} from "@/lib/categories";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileText, Trash2 } from "lucide-react";
import { StarToggle } from "@/components/StarToggle";
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
import { ContainerSelect } from "@/components/containers/ContainerSelect";
import { fetchContainers } from "@/lib/containers";
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
  IDENTIFICATION_STATUS,
  PERIODS,
  PUBLICATION_STATUS,
  RECORD_RESEARCH_STATUS,
  RECORD_TYPES,
  REVIEW_STATUS,
  SCAN_STATUS,
  STORAGE_TYPES,
  displayDate,
  isLetterType,
  labelOf,
} from "@/lib/archive";

import { useAuth } from "@/hooks/useAuth";
import { PersonCombobox } from "@/components/PersonCombobox";
import { PersonRoleInput, type PersonRoleValue } from "@/components/PersonRoleInput";
import {
  fetchLetterPersonByRole,
  setLetterPersonRole,
  type LetterPersonLink,
} from "@/lib/letter-people";
import { MentionsField } from "@/components/letter/MentionsField";
import { ToneMultiSelect } from "@/components/ToneMultiSelect";
import { DigitizationPanel } from "@/components/letter/DigitizationPanel";
import { fetchDigitalFiles } from "@/lib/digital-files";
import { DIGITIZATION_STATUS } from "@/lib/digitization";
import { LabelDialog } from "@/components/letter/LabelDialog";
import { LetterSourcesPanel } from "@/components/letter/LetterSourcesPanel";
import { ShareDialog, ShareStatusBadge } from "@/components/letter/ShareDialog";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { TranscriptionPanel } from "@/components/letter/TranscriptionPanel";
import {
  AiPanel,
  HistoryPanel,
  LinksPanel,
  ReferencesPanel,
  RelationsPanel,
} from "@/components/letter/ResearchPanels";

export const Route = createFileRoute("/_authenticated/letters/$archiveId")({
  validateSearch: (search: Record<string, unknown>): { hl?: string; tab?: string } => ({
    hl: typeof search.hl === "string" && search.hl.trim() ? search.hl : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `${params.archiveId} — The Francis Files` },
      {
        name: "description",
        content: `Archival record ${params.archiveId}: catalog metadata, scans, transcription, keywords and research notes.`,
      },
      { property: "og:title", content: `${params.archiveId} — The Francis Files` },
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
  { key: "date_as_written", label: "Date as written", letterOnly: false },
  { key: "author", label: "Author (from)", letterOnly: true },
  { key: "recipient", label: "Recipient (to)", letterOnly: true },
  { key: "origin", label: "Origin / location", letterOnly: false },
  { key: "destination", label: "Destination", letterOnly: true },
  { key: "primary_person", label: "Primary person", letterOnly: false },
];

const STORAGE_FIELDS = [
  { key: "storage_folder", label: "Folder / jacket", placeholder: "FH-0268" },
];



function LetterPage() {
  const { archiveId } = Route.useParams();
  const { hl, tab } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isGuestViewer } = useAuth();

  const { data: letter, isLoading } = useQuery({
    queryKey: ["letter", archiveId],
    queryFn: () => fetchLetterByArchiveId(archiveId),
  });
  const { data: all = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const { data: containers = [] } = useQuery({ queryKey: ["containers"], queryFn: fetchContainers });

  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const recordTypeOptions = useRecordTypeOptions();
  const subtypeOptions = useSubtypeOptions((form.record_type as string) || "letter");
  const invalidateCategories = useInvalidateCategories();
  const [tones, setTones] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const [authorPerson, setAuthorPerson] = useState<PersonRoleValue>(null);
  const [recipientPerson, setRecipientPerson] = useState<PersonRoleValue>(null);
  const [authorRecipientDirty, setAuthorRecipientDirty] = useState(false);


  useEffect(() => {
    if (!letter) return;
    setForm({
      record_type: letter.record_type ?? "letter",
      subtype: letter.subtype ?? "",
      title: letter.title ?? "",
      date_end: letter.date_end ?? "",
      primary_person: letter.primary_person ?? "",
      physical_description: letter.physical_description ?? "",
      storage_type: letter.storage_type ?? "",
      storage_folder: letter.storage_folder ?? "",
      identification_status: letter.identification_status ?? "",
      provenance: letter.provenance ?? "",
      source_container_id: letter.source_container_id ?? "",
      original_order_notes: letter.original_order_notes ?? "",
      digitization_notes: letter.digitization_notes ?? "",
      research_status: letter.research_status ?? "unreviewed",
      research_notes: letter.research_notes ?? "",
      citations: letter.citations ?? "",
      historical_notes: letter.historical_notes ?? "",
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
      notes: letter.notes ?? "",
      summary_short: letter.summary_short ?? "",
      summary_long: letter.summary_long ?? "",
      review_status: letter.review_status,
      scan_status: letter.scan_status,
      publication_status: letter.publication_status,
      research_needed: letter.research_needed,
    });
    setTones(letter.tones ?? []);
    setDirty(false);
  }, [letter]);

  useEffect(() => {
    if (!letter) return;
    let cancelled = false;
    (async () => {
      const [author, recipient] = await Promise.all([
        fetchLetterPersonByRole(letter.id, "author"),
        fetchLetterPersonByRole(letter.id, "recipient"),
      ]);
      if (cancelled) return;
      setAuthorPerson(author ? { id: author.person_id, name: author.name } : null);
      setRecipientPerson(recipient ? { id: recipient.person_id, name: recipient.name } : null);
      setAuthorRecipientDirty(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [letter?.id]);

  if (isLoading) return <div className="p-4 sm:p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!letter)
    return (
      <div className="p-4 sm:p-8">
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
    payload.record_type = form.record_type || "letter";
    payload.research_status = form.research_status || "unreviewed";
    payload.identification_status = form.identification_status || "unidentified";
    payload.tones = tones;


    const { error } = await supabase.from("letters").update(payload as never).eq("id", letter.id);
    if (error) return toast.error(error.message);
    await logEdits(letter.id, letter as unknown as Record<string, unknown>, payload);

    if (isLetterType(form.record_type as string) && authorRecipientDirty) {
      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth.user?.id;
      if (ownerId) {
        await setLetterPersonRole(letter.id, "author", authorPerson?.id ?? null, ownerId);
        await setLetterPersonRole(letter.id, "recipient", recipientPerson?.id ?? null, ownerId);
      }
      qc.invalidateQueries({ queryKey: ["links", letter.id] });
      setAuthorRecipientDirty(false);
    }

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
      <header className="no-print border-b border-border px-4 sm:px-8 py-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="archive-id font-display text-5xl leading-none">{letter.archive_id}</div>
              <StarToggle
                table="letters"
                id={letter.id}
                starred={Boolean(letter.starred)}
                label={`${letter.archive_id}${letter.title ? ` — ${letter.title}` : ""}`}
                showLabel
              />
            </div>
            <div className="mt-2 text-sm">
              <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-xs">
                {recordTypeOptions.find((o) => o.value === letter.record_type)?.label ??
                  labelOf(RECORD_TYPES, letter.record_type)}
                {letter.subtype ? ` · ${letter.subtype}` : ""}
              </span>
              {letter.title && <span className="ml-3 font-medium">{letter.title}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">

              <span>
                <span className="field-label mr-2">Date</span>
                {displayDate(letter)}
              </span>
              <span>
                <span className="field-label mr-2">From</span>
                {authorPerson?.id ? (
                  <Link
                    to="/people/$personId"
                    params={{ personId: authorPerson.id }}
                    className="text-primary hover:underline"
                  >
                    {letter.author}
                  </Link>
                ) : (
                  letter.author || "—"
                )}
              </span>
              <span>
                <span className="field-label mr-2">To</span>
                {recipientPerson?.id ? (
                  <Link
                    to="/people/$personId"
                    params={{ personId: recipientPerson.id }}
                    className="text-primary hover:underline"
                  >
                    {letter.recipient}
                  </Link>
                ) : (
                  letter.recipient || "—"
                )}
              </span>
              <span>
                <span className="field-label mr-2">Origin</span>
                {letter.origin || "—"}
              </span>
              <span>
                <span className="field-label mr-2">ID status</span>
                {labelOf(IDENTIFICATION_STATUS, letter.identification_status)}
              </span>
              <span>
                <span className="field-label mr-2">Digitization</span>
                {labelOf(DIGITIZATION_STATUS, letter.digitization_status ?? "not_scanned")}
              </span>
              <span>
                <span className="field-label mr-2">Stored</span>
                {[
                  labelOf(STORAGE_TYPES, letter.storage_type),
                  letter.storage_folder,
                ]
                  .filter((v) => v && v !== "—")
                  .join(" · ") || "—"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareStatusBadge letter={letter} />
            <LabelDialog letter={letter} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTranscription((v) => !v)}
            >
              <FileText className="mr-1.5 size-4" />
              {showTranscription ? "Hide transcription" : "Show transcription"}
            </Button>
            {!isGuestViewer && (
              <>
                <ShareDialog letter={letter} />
                <EmailArchiveDialog
                  kind="letter"
                  id={letter.id}
                  identifier={letter.archive_id}
                  title={letter.title}
                />
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
                        {letter.archive_id} is the most recently issued number, it will be reused
                        for your next entry. This cannot be undone.
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
                <Button onClick={save} disabled={!dirty && !authorRecipientDirty}>
                  {dirty || authorRecipientDirty ? "Save changes" : "Saved"}
                </Button>
              </>
            )}
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

      {showTranscription && (
        <section className="mx-4 mt-4 rounded border border-border bg-card p-4 sm:mx-8">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Transcription</h3>
            <span className="text-xs text-muted-foreground">
              {letter.transcription_verified?.trim()
                ? "Human verified"
                : letter.transcription_raw_ai?.trim()
                  ? "AI transcription"
                  : "No transcription"}
            </span>
          </div>
          <div className="max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">
            {letter.transcription_verified?.trim() || letter.transcription_raw_ai?.trim() ? (
              letter.transcription_verified?.trim() || letter.transcription_raw_ai
            ) : (
              <span className="text-muted-foreground">
                No transcription available yet. Open the Transcription tab to generate one.
              </span>
            )}
          </div>
        </section>
      )}

      <Tabs
        key={tab ?? "catalog"}
        defaultValue={tab === "transcription" || tab === "digitization" ? tab : "catalog"}
        className="px-4 sm:px-8 py-6"
      >
        <TabsList className="no-print">
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="digitization">Scans &amp; Files ({letter.image_count})</TabsTrigger>
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
          <TabsTrigger value="links">People · Places · Keywords</TabsTrigger>
          <TabsTrigger value="references">Research</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="ai">AI Analysis</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6">
          {/* Guests browse in read-only mode — the disabled fieldset blocks edits
              in every input/button below without changing the layout. */}
          <fieldset disabled={isGuestViewer} className="contents">
          <div className="grid max-w-5xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Record type</label>
              <CategorySelect
                value={(form.record_type as string) ?? "letter"}
                onChange={(v) => {
                  set("record_type", v);
                  set("subtype", "");
                }}
                options={recordTypeOptions}
                onCreate={async (label) => {
                  const v = await addRecordType(label, recordTypeOptions);
                  invalidateCategories();
                  return v;
                }}
              />
            </div>
            <div>
              <label className="field-label">Subtype</label>
              <CategorySelect
                value={(form.subtype as string) ?? ""}
                allowEmpty
                onChange={(v) => set("subtype", v)}
                options={subtypeOptions.map((s) => ({ value: s, label: s }))}
                onCreate={async (label) => {
                  const v = await addSubtype(
                    (form.record_type as string) ?? "letter",
                    label,
                    subtypeOptions,
                  );
                  invalidateCategories();
                  return v;
                }}
              />
            </div>
            <div>
              <label className="field-label">Title / short description</label>
              <Input
                value={(form.title as string) ?? ""}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Normalized date</label>
              <Input
                type="date"
                value={(form.normalized_date as string) ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return set("normalized_date", "");
                  const precision = String(form.date_precision);
                  if (precision === "year") {
                    return set("normalized_date", `${value.slice(0, 4)}-01-01`);
                  }
                  if (precision === "month") {
                    return set("normalized_date", `${value.slice(0, 7)}-01`);
                  }
                  setDirty(true);
                  setForm((f) => ({
                    ...f,
                    normalized_date: value,
                    // A real date was entered — don't keep the record flagged undated.
                    date_precision:
                      precision === "undated" || precision === "unknown" ? "exact" : precision,
                  }));
                }}

              />
              <div className="flex gap-3 pt-1.5">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={form.date_precision === "year"}
                    onChange={(e) => {
                      setDirty(true);
                      setForm((f) => ({
                        ...f,
                        date_precision: e.target.checked ? "year" : "exact",
                        normalized_date:
                          e.target.checked && f.normalized_date
                            ? `${String(f.normalized_date).slice(0, 4)}-01-01`
                            : f.normalized_date,
                      }));
                    }}
                  />
                  Year only
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={form.date_precision === "month"}
                    onChange={(e) => {
                      setDirty(true);
                      setForm((f) => ({
                        ...f,
                        date_precision: e.target.checked ? "month" : "exact",
                        normalized_date:
                          e.target.checked && f.normalized_date
                            ? `${String(f.normalized_date).slice(0, 7)}-01`
                            : f.normalized_date,
                      }));
                    }}
                  />
                  Month / year only
                </label>
              </div>
            </div>
            <div>
              <label className="field-label">End date (range)</label>
              <Input
                type="date"
                value={(form.date_end as string) ?? ""}
                onChange={(e) => set("date_end", e.target.value)}
              />
            </div>

            {TEXT_FIELDS.filter(
              (f) => !f.letterOnly || isLetterType(form.record_type as string),
            ).map((f) => (
              <div key={f.key}>
                <label className="field-label">{f.label}</label>
                {f.key === "primary_person" ? (
                  <PersonCombobox
                    value={(form[f.key] as string) ?? ""}
                    onChange={(v) => set(f.key, v)}
                  />
                ) : f.key === "author" ? (
                  <PersonRoleInput
                    value={authorPerson}
                    onChange={(person, name) => {
                      setAuthorPerson(person);
                      set("author", name);
                      setAuthorRecipientDirty(true);
                    }}
                    placeholder="Select or add sender…"
                  />
                ) : f.key === "recipient" ? (
                  <PersonRoleInput
                    value={recipientPerson}
                    onChange={(person, name) => {
                      setRecipientPerson(person);
                      set("recipient", name);
                      setAuthorRecipientDirty(true);
                    }}
                    placeholder="Select or add recipient…"
                  />
                ) : (
                  <Input
                    value={(form[f.key] as string) ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
                {f.key === "primary_person" && (
                  <div className="mt-3">
                    <label className="field-label">Mentions</label>
                    <MentionsField letterId={letter.id} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Other people named in this record — saved immediately as “mentioned”.
                    </p>
                  </div>
                )}
              </div>
            ))}


            {[
              { key: "date_precision", label: "Date status / precision", opts: DATE_PRECISION },
              { key: "date_certainty", label: "Date certainty", opts: DATE_CERTAINTY },
              { key: "period", label: "Period", opts: PERIODS },
              {
                key: "identification_status",
                label: "Identification status",
                opts: IDENTIFICATION_STATUS,
              },
              { key: "scan_status", label: "Scan status", opts: SCAN_STATUS },
              { key: "review_status", label: "Review status", opts: REVIEW_STATUS },
              { key: "publication_status", label: "Publication status", opts: PUBLICATION_STATUS },
              { key: "research_status", label: "Research status", opts: RECORD_RESEARCH_STATUS },
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

            <div className="col-span-full rounded border border-border bg-card p-4">
              <div className="field-label mb-1">Tone / sentiment (optional)</div>
              <p className="mb-3 text-xs text-muted-foreground">
                The emotional character of this record — kept separate from keywords/subjects.
              </p>
              <div className="max-w-md">
                <ToneMultiSelect
                  value={tones}
                  onChange={(v) => {
                    setTones(v);
                    setDirty(true);
                  }}
                />
              </div>
            </div>

            <div className="col-span-full rounded border border-border bg-card p-4">
              <div className="field-label mb-3">Physical storage location</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="field-label">Storage type</label>
                  <select
                    className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
                    value={(form.storage_type as string) ?? ""}
                    onChange={(e) => set("storage_type", e.target.value)}
                  >
                    {STORAGE_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {STORAGE_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="field-label">{f.label}</label>
                    <Input
                      placeholder={f.placeholder}
                      value={(form[f.key] as string) ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-full rounded border border-border bg-card p-4">
              <div className="field-label mb-3">Original source container (provenance)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <ContainerSelect
                    value={(form.source_container_id as string) ?? ""}
                    onChange={(v) => set("source_container_id", v)}
                  />
                  {form.source_container_id ? (
                    <Link
                      to="/containers/$boxId"
                      params={{
                        boxId:
                          containers.find((c) => c.id === form.source_container_id)?.box_id ?? "",
                      }}
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      Open container record
                    </Link>
                  ) : null}
                </div>
                <div>
                  <label className="field-label">Original order / position notes</label>
                  <Input
                    value={(form.original_order_notes as string) ?? ""}
                    onChange={(e) => set("original_order_notes", e.target.value)}
                  />
                </div>
              </div>
            </div>

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
            <div className="col-span-full">
              <label className="field-label">General notes (my interpretation / research)</label>
              <Textarea
                rows={4}
                value={(form.notes as string) ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Physical description</label>
                <Textarea
                  rows={3}
                  value={(form.physical_description as string) ?? ""}
                  onChange={(e) => set("physical_description", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Provenance</label>
                <Textarea
                  rows={3}
                  value={(form.provenance as string) ?? ""}
                  onChange={(e) => set("provenance", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Historical context notes</label>
                <Textarea
                  rows={3}
                  value={(form.historical_notes as string) ?? ""}
                  onChange={(e) => set("historical_notes", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Private research notes</label>
                <Textarea
                  rows={3}
                  value={(form.research_notes as string) ?? ""}
                  onChange={(e) => set("research_notes", e.target.value)}
                />
              </div>
              <div className="col-span-full">
                <label className="field-label">Citations / sources</label>
                <Textarea
                  rows={2}
                  value={(form.citations as string) ?? ""}
                  onChange={(e) => set("citations", e.target.value)}
                />
              </div>
            </div>
          </div>
          </fieldset>
        </TabsContent>

        <TabsContent value="digitization" className="mt-6">
          <DigitizationPanel letter={letter} />
        </TabsContent>

        <TabsContent value="transcription" className="mt-6">
          <TranscriptionPanel letter={letter} highlight={hl} />
        </TabsContent>
        <TabsContent value="links" className="mt-6">
          <fieldset disabled={isGuestViewer} className="contents">
            <LinksPanel letter={letter} />
          </fieldset>
        </TabsContent>
        <TabsContent value="references" className="mt-6">
          <fieldset disabled={isGuestViewer} className="contents">
            <ReferencesPanel letter={letter} />
          </fieldset>
        </TabsContent>
        <TabsContent value="related" className="mt-6 space-y-10">
          <fieldset disabled={isGuestViewer} className="contents">
            <RelationsPanel letter={letter} />
            <LetterSourcesPanel letter={letter} />
          </fieldset>
        </TabsContent>
        <TabsContent value="ai" className="mt-6">
          <fieldset disabled={isGuestViewer} className="contents">
            <AiPanel letter={letter} />
          </fieldset>
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <HistoryPanel letter={letter} />
        </TabsContent>
      </Tabs>
      <div className="px-4 sm:px-8 pb-10 text-xs text-muted-foreground">
        Record created {new Date(letter.created_at).toLocaleDateString()} · modified{" "}
        {new Date(letter.updated_at).toLocaleDateString()} ·{" "}
        <button className="underline" onClick={() => navigate({ to: "/letters" })}>
          back to table
        </button>
      </div>
    </>
  );
}
