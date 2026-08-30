import { useRecordTypeOptions } from "@/lib/categories";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { VISIBILITY } from "@/lib/shares";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, Mail, RotateCcw } from "lucide-react";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ToneMultiSelect } from "@/components/ToneMultiSelect";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  fetchAllMatchingLetters,
  logEdits,
  searchLetters,
  type Letter,
  type LetterSearchParams,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  DATE_PRECISION,
  IDENTIFICATION_STATUS,
  PERIODS,
  RECORD_RESEARCH_STATUS,
  REVIEW_STATUS,
  SCAN_STATUS,
  STORAGE_TYPES,
  TRANSCRIPTION_STATUS,
  displayDate,
  download,
  labelOf,
  toCsv,
  toExcelXml,
} from "@/lib/archive";
import { DIGITIZATION_STATUS } from "@/lib/digitization";

import { StarToggle } from "@/components/StarToggle";
import { FffBadge } from "@/components/FffBadge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const searchSchema = z.object({
  type: z.string().optional(),
  period: z.string().optional(),
  tstatus: z.string().optional(),
  review: z.string().optional(),
  scan: z.string().optional(), // "has" | "none"

  uncertain: z.coerce.string().optional(), // "1"
  starred: z.coerce.string().optional(), // "1"
});

export const Route = createFileRoute("/_authenticated/letters/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Letters Table — The Francis Files" },
      {
        name: "description",
        content:
          "Spreadsheet view of every cataloged letter with sorting, filtering, inline editing and CSV/Excel export.",
      },
      { property: "og:title", content: "Letters Table — The Francis Files" },
      {
        property: "og:description",
        content: "Spreadsheet view of the letter catalog with filtering and export.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <LettersTable />
    </AppShell>
  ),
});

type Col = { key: string; label: string; width: number; editable?: boolean };

/** macOS-style traffic-light dot summarizing scan/transcription state. */
function recordHealth(l: Letter): { color: string; label: string } {
  if (l.scan_status === "not_scanned" || l.transcription_status === "failed")
    return { color: "#FF5F57", label: "No scans or a problem detected with this record" };
  if (l.transcription_status === "human_verified")
    return { color: "#28C840", label: "Transcribed, AI summary, human checked" };
  return { color: "#FEBC2E", label: "Scans uploaded, transcription pending" };
}

const COLUMNS: Col[] = [
  { key: "archive_id", label: "FH ID", width: 130 },
  { key: "record_type", label: "Type", width: 150 },
  { key: "subtype", label: "Subtype", width: 130 },
  { key: "title", label: "Title", width: 200, editable: true },
  { key: "date", label: "Date", width: 150 },
  { key: "date_precision", label: "Date status", width: 130 },
  { key: "identification_status", label: "ID status", width: 130 },
  { key: "primary_person", label: "Primary person", width: 150, editable: true },
  { key: "author", label: "From", width: 150, editable: true },
  { key: "recipient", label: "To", width: 150, editable: true },
  { key: "origin", label: "Origin", width: 160, editable: true },
  { key: "storage", label: "Storage", width: 200 },
  { key: "period", label: "Period", width: 100 },
  { key: "sheets", label: "Sheets", width: 70, editable: true },
  { key: "image_count", label: "Images", width: 70 },
  { key: "has_envelope", label: "Env", width: 60 },
  { key: "digitization_status", label: "Digitization", width: 160 },
  { key: "scan_status", label: "Scan", width: 110 },
  { key: "transcription_status", label: "Transcription", width: 130 },
  { key: "starred", label: "FFF", width: 90 },
  { key: "tones", label: "Tone / sentiment", width: 200 },
  { key: "keywords", label: "Keywords", width: 180 },
  { key: "notes", label: "Notes", width: 220, editable: true },
];

const PAGE_SIZE = 100;

/** Debounce a value so filtering doesn't fire a query on every keystroke. */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Human-readable one-line physical location. */
function storageText(l: Letter) {
  const parts = [labelOf(STORAGE_TYPES, l.storage_type), l.storage_folder].filter(
    (v) => v && v !== "—",
  );
  return parts.join(" · ");
}

type KeywordRow = { letter_id: string; keywords: { name: string } | null };

function groupKeywords(tags: KeywordRow[]) {
  const m: Record<string, string[]> = {};
  for (const t of tags) {
    if (!t.keywords) continue;
    (m[t.letter_id] ??= []).push(t.keywords.name);
  }
  return m;
}

/** Keyword names for a set of letter ids, fetched in PostgREST-safe chunks. */
async function fetchKeywordsForLetters(ids: string[]): Promise<Record<string, string[]>> {
  const all: KeywordRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("letter_keywords")
      .select("letter_id, keywords(name)")
      .in("letter_id", ids.slice(i, i + 200));
    if (error) throw error;
    all.push(...((data ?? []) as unknown as KeywordRow[]));
  }
  return groupKeywords(all);
}

function LettersTable() {
  const { isGuestViewer } = useAuth();
  const navigate = useNavigate({ from: "/letters/" });
  const qc = useQueryClient();
  const search = Route.useSearch();
  const recordTypeOptions = useRecordTypeOptions();

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [period, setPeriod] = useState(search.period ?? "");
  const [tStatus, setTStatus] = useState(search.tstatus ?? "");
  const [rType, setRType] = useState(search.type ?? "");
  const [review, setReview] = useState(search.review ?? "");
  const [scanF, setScanF] = useState(search.scan ?? "");
  const [uncertainOnly, setUncertainOnly] = useState(search.uncertain === "1");
  const [starredOnly, setStarredOnly] = useState(search.starred === "1");

  // Keep filters in sync when arriving from a dashboard stat link.
  useEffect(() => {
    setRType(search.type ?? "");
    setPeriod(search.period ?? "");
    setTStatus(search.tstatus ?? "");
    setReview(search.review ?? "");
    setScanF(search.scan ?? "");
    setUncertainOnly(search.uncertain === "1");
    setStarredOnly(search.starred === "1");
  }, [search]);

  const [idStatus, setIdStatus] = useState("");
  const [dStatus, setDStatus] = useState("");
  const [digStatus, setDigStatus] = useState("");
  const [tones, setTones] = useState<string[]>([]);
  const [view, setView] = useState<"" | "undated" | "unidphoto">("");

  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "archive_id", dir: 1 });
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<string[]>([]);
  const [widths, setWidths] = useState<Record<string, number>>({});

  // Persist column widths so resizes survive reloads and navigation.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("letters_col_widths");
      if (raw) setWidths(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* ignore corrupt saved widths */
    }
  }, []);
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [selected, setSelected] = useState<Map<string, SelectedRecord>>(new Map());
  const [exporting, setExporting] = useState(false);

  // Any filter change goes back to page 1.
  useEffect(() => {
    setPage(0);
  }, [debouncedQ, period, tStatus, rType, review, scanF, uncertainOnly, starredOnly, idStatus, dStatus, digStatus, tones, view, sort]);

  const params: LetterSearchParams = {
    q: debouncedQ,
    type: rType,
    period,
    tstatus: tStatus,
    review,
    scan: scanF as "" | "has" | "none",
    uncertain: uncertainOnly,
    starred: starredOnly,
    idStatus,
    datePrecision: dStatus,
    digStatus,
    tones,
    view,
    sort: sort.key,
    dir: sort.dir === 1 ? "asc" : "desc",
  };

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["letters-page", { ...params, page }],
    queryFn: () => searchLetters({ ...params, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Keyword names only for the records on this page.
  const pageIds = rows.map((l) => l.id);
  const { data: keywordsByLetter = {} } = useQuery({
    queryKey: ["letters-page-keywords", pageIds],
    enabled: pageIds.length > 0,
    queryFn: () => fetchKeywordsForLetters(pageIds),
  });

  const cols = COLUMNS.filter((c) => !hidden.includes(c.key));

  type SelectedRecord = { kind: "letter"; id: string; identifier: string; title: string | null };
  const selectedRecords = [...selected.values()];
  const toggleSelected = (l: Letter, on: boolean) =>
    setSelected((s) => {
      const next = new Map(s);
      if (on) next.set(l.id, { kind: "letter", id: l.id, identifier: l.archive_id, title: l.title });
      else next.delete(l.id);
      return next;
    });
  const allSelected = rows.length > 0 && rows.every((l) => selected.has(l.id));

  /** Export every record matching the current filters (all pages). */
  async function buildExportRows() {
    const all = await fetchAllMatchingLetters(params);
    const kw = await fetchKeywordsForLetters(all.map((l) => l.id));
    return all.map((l) => ({
      fh_id: l.archive_id,
      record_type: labelOf(recordTypeOptions, l.record_type),
      subtype: l.subtype ?? "",
      title: l.title ?? "",
      primary_person: l.primary_person ?? "",
      date_normalized: l.normalized_date ?? "",
      date_end: l.date_end ?? "",

      date_as_written: l.date_as_written ?? "",
      date_precision: l.date_precision,
      date_certainty: l.date_certainty,
      from: l.author ?? "",
      to: l.recipient ?? "",
      origin: l.origin ?? "",
      destination: l.destination ?? "",
      period: l.period,
      sheets: l.sheets ?? "",
      images: l.image_count,
      envelope: l.has_envelope ? "Yes" : "No",
      enclosures: l.has_enclosures ? "Yes" : "No",
      physical_description: l.physical_description ?? "",
      identification_status: labelOf(IDENTIFICATION_STATUS, l.identification_status),
      storage_type: labelOf(STORAGE_TYPES, l.storage_type),

      storage_folder: l.storage_folder ?? "",
      research_status: l.research_status ?? "",

      digitization_status: labelOf(DIGITIZATION_STATUS, l.digitization_status ?? "not_scanned"),
      expected_scan_count: l.expected_scan_count ?? "",
      scan_status: l.scan_status,
      transcription_status: l.transcription_status,
      review_status: l.review_status,
      publication_status: l.publication_status,
      keywords: (kw[l.id] ?? []).join("; "),
      tones: (l.tones ?? []).join("; "),
      summary_short: l.summary_short ?? "",
      notes: l.notes ?? "",
      transcription_verified: l.transcription_verified ?? "",
      created_at: l.created_at,
      updated_at: l.updated_at,
    }));
  }

  async function runExport(kind: "csv" | "excel") {
    setExporting(true);
    try {
      const data = await buildExportRows();
      const cols = Object.keys(data[0] ?? { fh_id: "" });
      if (kind === "csv") download("francis-files.csv", toCsv(data, cols), "text/csv");
      else download("francis-files.xls", toExcelXml(data, cols), "application/vnd.ms-excel");
      toast.success(`Exported ${data.length} records`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function saveCell(letter: Letter, key: string, raw: string) {
    setEditing(null);
    const value = key === "sheets" ? (raw ? Number(raw) : null) : raw || null;
    if (String(letter[key as keyof Letter] ?? "") === String(value ?? "")) return;
    const { error } = await supabase.from("letters").update({ [key]: value } as never).eq("id", letter.id);
    if (error) return toast.error(error.message);
    await logEdits(letter.id, { [key]: letter[key as keyof Letter] }, { [key]: value });
    qc.invalidateQueries({ queryKey: ["letters-page"] });
  }

  function resetFilters() {
    setQ("");
    setPeriod("");
    setTStatus("");
    setRType("");
    setReview("");
    setScanF("");
    setUncertainOnly(false);
    setIdStatus("");
    setDStatus("");
    setDigStatus("");
    setTones([]);
    setView("");
    setSort({ key: "archive_id", dir: 1 });
    setStarredOnly(false);
    setPage(0);
    navigate({ to: "/letters", search: () => ({}) });
  }

  const activeFilterCount = [
    q,
    period,
    tStatus,
    rType,
    review,
    scanF,
    idStatus,
    dStatus,
    digStatus,
    view,
    uncertainOnly ? "uncertain" : "",
    starredOnly ? "starred" : "",
    ...tones,
  ].filter(Boolean).length;

  function cellValue(l: Letter, key: string) {
    switch (key) {
      case "starred":
        return l.starred ? "Yes" : "";
      case "date":
        return displayDate(l);
      case "record_type":
        return labelOf(recordTypeOptions, l.record_type);
      case "date_precision":
        return labelOf(DATE_PRECISION, l.date_precision);
      case "identification_status":
        return labelOf(IDENTIFICATION_STATUS, l.identification_status);
      case "storage":
        return storageText(l);
      case "research_status":
        return labelOf(RECORD_RESEARCH_STATUS, l.research_status);
      case "period":

        return labelOf(PERIODS, l.period);
      case "scan_status":
        return labelOf(SCAN_STATUS, l.scan_status);
      case "digitization_status":
        return labelOf(DIGITIZATION_STATUS, l.digitization_status ?? "not_scanned");
      case "transcription_status":
        return labelOf(TRANSCRIPTION_STATUS, l.transcription_status);
      case "review_status":
        return labelOf(REVIEW_STATUS, l.review_status);
      case "has_envelope":
        return l.has_envelope ? "Yes" : "No";
      case "keywords":
        return (keywordsByLetter[l.id] ?? []).join(", ");
      case "tones":
        return (l.tones ?? []).join(", ");
      case "visibility":
        return (
          VISIBILITY.find((v) => v.value === ((l as Letter & { visibility?: string }).visibility ?? "private"))
            ?.label ?? "Private"
        );
      default:
        return (l[key as keyof Letter] ?? "") as string;
    }
  }

  return (
    <>
      <PageHeader
        title="All Records"
        description={`${total} records${activeFilterCount ? " matching filters" : ""}`}
        actions={
          <>
            {!isGuestViewer && selectedRecords.length > 0 && (
              <EmailArchiveDialog
                records={selectedRecords}
                trigger={
                  <Button variant="outline" size="sm" className="gap-2">
                    <Mail className="size-4" /> Email selected ({selectedRecords.length})
                  </Button>
                }
              />
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={exporting}
              onClick={() => runExport("csv")}
            >
              <Download className="size-4" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={exporting}
              onClick={() => runExport("excel")}
            >
              <Download className="size-4" /> Excel
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Eye className="size-4" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {COLUMNS.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={!hidden.includes(c.key)}
                    onCheckedChange={(v) =>
                      setHidden((h) => (v ? h.filter((x) => x !== c.key) : [...h, c.key]))
                    }
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 sm:px-8 py-3">
        <Input
          placeholder="Filter…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 w-64"
        />
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={rType}
          onChange={(e) => setRType(e.target.value)}
        >
          <option value="">All record types</option>
          {recordTypeOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={digStatus}
          onChange={(e) => setDigStatus(e.target.value)}
        >
          <option value="">All digitization states</option>
          {DIGITIZATION_STATUS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>


        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="">All periods</option>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={tStatus}
          onChange={(e) => setTStatus(e.target.value)}
        >
          <option value="">All transcription states</option>
          {TRANSCRIPTION_STATUS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={idStatus}
          onChange={(e) => setIdStatus(e.target.value)}
        >
          <option value="">All ID states</option>
          {IDENTIFICATION_STATUS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={dStatus}
          onChange={(e) => setDStatus(e.target.value)}
        >
          <option value="">All date states</option>
          {DATE_PRECISION.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="w-60">
          <ToneMultiSelect
            value={tones}
            onChange={setTones}
            placeholder="All tones / sentiments"
          />
        </div>



        <Button
          variant={starredOnly ? "default" : "outline"}
          size="sm"
          className="gap-2"
          aria-pressed={starredOnly}
          onClick={() => setStarredOnly((v) => !v)}
        >
          <FffBadge size={16} muted={!starredOnly} />
          FFF only
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={resetFilters}
          disabled={activeFilterCount === 0}
        >
          <RotateCcw className="size-4" />
          Reset filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="field-label">Views</span>
          {[
            { key: "", label: "All" },
            { key: "undated", label: "Undated" },
            { key: "unidphoto", label: "Unidentified photos" },
          ].map((v) => (
            <Button
              key={v.key}
              size="sm"
              variant={view === v.key ? "default" : "outline"}
              onClick={() => setView(v.key as "" | "undated" | "unidphoto")}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-b border-border px-4 sm:px-8 py-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <span className="tabular-nums text-muted-foreground">
          Page {page + 1} of {pageCount}
          {total > 0 && (
            <>
              {" "}· {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
            </>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <ChevronRight className="size-4" />
        </Button>
        {isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-secondary">
            <tr>
              <th className="w-8 border-b border-border px-2 py-2">
                {!isGuestViewer && (
                <Checkbox
                  aria-label="Select all records"
                  checked={allSelected}
                  onCheckedChange={(v) =>
                    setSelected((s) => {
                      const next = new Map(s);
                      if (v) rows.forEach((l) => next.set(l.id, { kind: "letter", id: l.id, identifier: l.archive_id, title: l.title }));
                      else rows.forEach((l) => next.delete(l.id));
                       return next;
                     })
                   }
                 />
                )}
               </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  style={{ width: widths[c.key] ?? c.width }}
                  className="relative border-b border-border px-3 py-2 text-left font-medium select-none"
                >
                  <button
                    className="field-label hover:text-foreground"
                    onClick={() =>
                      setSort((s) =>
                        s.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 },
                      )
                    }
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </button>
                  <span
                    role="separator"
                    onMouseDown={(e) => {
                      const startX = e.clientX;
                      const startW = widths[c.key] ?? c.width;
                      const move = (ev: MouseEvent) =>
                        setWidths((w) => ({
                          ...w,
                          [c.key]: Math.max(60, startW + ev.clientX - startX),
                        }));
                      const up = () => {
                        window.removeEventListener("mousemove", move);
                        window.removeEventListener("mouseup", up);
                      };
                      window.addEventListener("mousemove", move);
                      window.addEventListener("mouseup", up);
                    }}
                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/40"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-border hover:bg-muted/50">
                <td className="px-2 py-1.5 align-top">
                  {!isGuestViewer && (
                    <Checkbox
                      aria-label={`Select ${l.archive_id}`}
                      checked={selected.has(l.id)}
                      onCheckedChange={(v) => toggleSelected(l, Boolean(v))}
                    />
                  )}
                </td>
                {cols.map((c) => {
                  const isEditing = editing?.id === l.id && editing.key === c.key;
                  return (
                    <td
                      key={c.key}
                      className="truncate px-3 py-1.5 align-top"
                      style={{ maxWidth: widths[c.key] ?? c.width }}
                      onDoubleClick={() =>
                        c.editable && !isGuestViewer && setEditing({ id: l.id, key: c.key })
                      }
                    >
                      {c.key === "archive_id" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <StarToggle
                            table="letters"
                            id={l.id}
                            starred={Boolean(l.starred)}
                            label={`${l.archive_id}${l.title ? ` — ${l.title}` : ""}`}
                            size="sm"
                            className="size-6"
                          />
                          <Link
                            to="/letters/$archiveId"
                            params={{ archiveId: l.archive_id }}
                            className="archive-id text-primary hover:underline"
                          >
                            {l.archive_id}
                          </Link>
                          <span
                            title={recordHealth(l).label}
                            aria-label={recordHealth(l).label}
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 shadow-[inset_0_-1px_1px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.5)]"
                            style={{ backgroundColor: recordHealth(l).color }}
                          />
                          {!isGuestViewer && (
                            <EmailArchiveDialog
                              kind="letter"
                              id={l.id}
                              identifier={l.archive_id}
                              title={l.title}
                              trigger={
                                <button
                                  type="button"
                                  title={`Email ${l.archive_id}`}
                                  aria-label={`Email ${l.archive_id}`}
                                  className="inline-flex size-6 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                                >
                                  <Mail className="size-3" strokeWidth={2.25} />
                                </button>
                              }
                            />
                          )}
                        </span>
                      ) : isEditing ? (
                        <input
                          autoFocus
                          defaultValue={String(l[c.key as keyof Letter] ?? "")}
                          className="w-full rounded border border-ring bg-background px-1"
                          onBlur={(e) => saveCell(l, c.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        <span className={c.editable ? "cursor-text" : ""}>{cellValue(l, c.key)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !isLoading && (
          <p className="px-4 sm:px-8 py-6 sm:py-8 text-sm text-muted-foreground">No matching records.</p>
        )}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-8 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#28C840" }} /> Transcribed &amp; human checked</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#FEBC2E" }} /> Scanned, transcription pending</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#FF5F57" }} /> No scans or problem detected</span>
        </p>
        <p className="px-4 sm:px-8 py-3 text-xs text-muted-foreground">
          Double-click an editable cell (From, To, Origin, Sheets, Notes) to edit inline. Changes
          are recorded in the letter's edit history.
        </p>
      </div>
    </>
  );
}
