import { useRecordTypeOptions } from "@/lib/categories";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { VISIBILITY } from "@/lib/shares";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Mail, RotateCcw } from "lucide-react";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ToneMultiSelect } from "@/components/ToneMultiSelect";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchLetters, logEdits, type Letter } from "@/lib/queries";
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
  isUnidentifiedPhoto,
  labelOf,
  needsDating,
  toCsv,
  toExcelXml,
} from "@/lib/archive";
import { DIGITIZATION_STATUS } from "@/lib/digitization";

import { toast } from "sonner";

const searchSchema = z.object({
  type: z.string().optional(),
  period: z.string().optional(),
  tstatus: z.string().optional(),
  review: z.string().optional(),
  scan: z.string().optional(), // "has" | "none"
  cataloged: z.string().optional(), // "1"
  uncertain: z.string().optional(), // "1"
});

export const Route = createFileRoute("/letters/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Letters Table — Harrington Letter Archive" },
      {
        name: "description",
        content:
          "Spreadsheet view of every cataloged letter with sorting, filtering, inline editing and CSV/Excel export.",
      },
      { property: "og:title", content: "Letters Table — Harrington Letter Archive" },
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
  { key: "tones", label: "Tone / sentiment", width: 200 },
  { key: "keywords", label: "Keywords", width: 180 },
  { key: "notes", label: "Notes", width: 220, editable: true },
];

/** Human-readable one-line physical location. */
function storageText(l: Letter) {
  const parts = [
    labelOf(STORAGE_TYPES, l.storage_type),
    l.storage_container,
    l.storage_folder,
    l.storage_position,
  ].filter((v) => v && v !== "—");
  return parts.join(" · ") || (l.storage_location ?? "");
}

function LettersTable() {
  const navigate = useNavigate({ from: "/letters/" });
  const qc = useQueryClient();
  const { data: letters = [] } = useQuery({ queryKey: ["letters"], queryFn: fetchLetters });
  const { data: tags = [] } = useQuery({
    queryKey: ["letter_keywords_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letter_keywords")
        .select("letter_id, keywords(name)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const keywordsByLetter = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const t of tags as { letter_id: string; keywords: { name: string } | null }[]) {
      if (!t.keywords) continue;
      (m[t.letter_id] ??= []).push(t.keywords.name);
    }
    return m;
  }, [tags]);

  const search = Route.useSearch();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState(search.period ?? "");
  const [tStatus, setTStatus] = useState(search.tstatus ?? "");
  const [rType, setRType] = useState(search.type ?? "");
  const [review, setReview] = useState(search.review ?? "");
  const [scanF, setScanF] = useState(search.scan ?? "");
  const [catalogedOnly, setCatalogedOnly] = useState(search.cataloged === "1");
  const [uncertainOnly, setUncertainOnly] = useState(search.uncertain === "1");

  // Keep filters in sync when arriving from a dashboard stat link.
  useEffect(() => {
    setRType(search.type ?? "");
    setPeriod(search.period ?? "");
    setTStatus(search.tstatus ?? "");
    setReview(search.review ?? "");
    setScanF(search.scan ?? "");
    setCatalogedOnly(search.cataloged === "1");
    setUncertainOnly(search.uncertain === "1");
  }, [search]);
  const recordTypeOptions = useRecordTypeOptions();
  const [idStatus, setIdStatus] = useState("");
  const [dStatus, setDStatus] = useState("");
  const [digStatus, setDigStatus] = useState("");
  const [tones, setTones] = useState<string[]>([]);
  const [view, setView] = useState<"" | "undated" | "unidphoto">("");

  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "archive_id", dir: 1 });
  const [hidden, setHidden] = useState<string[]>([]);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);

  const cols = COLUMNS.filter((c) => !hidden.includes(c.key));

  const rows = useMemo(() => {
    let r = letters.filter((l) => {
      if (view === "undated" && !needsDating(l)) return false;
      if (view === "unidphoto" && !isUnidentifiedPhoto(l)) return false;
      if (period && l.period !== period) return false;
      if (tStatus) {
        if (tStatus.startsWith("!")) {
          if (l.transcription_status === tStatus.slice(1)) return false;
        } else if (l.transcription_status !== tStatus) return false;
      }
      if (rType && (l.record_type ?? "letter") !== rType) return false;
      if (review && l.review_status !== review) return false;
      if (scanF === "has" && l.image_count === 0) return false;
      if (scanF === "none" && l.image_count > 0) return false;
      if (catalogedOnly && !(l.author || l.recipient || l.normalized_date)) return false;
      if (uncertainOnly && l.date_certainty === "confirmed" && l.date_precision === "exact")
        return false;
      if (idStatus && (l.identification_status ?? "unidentified") !== idStatus) return false;
      if (dStatus && l.date_precision !== dStatus) return false;
      if (digStatus && (l.digitization_status ?? "not_scanned") !== digStatus) return false;
      if (tones.length && !tones.every((t) => (l.tones ?? []).includes(t))) return false;

      if (!q) return true;
      const hay = [
        l.archive_id,
        l.title,
        l.author,
        l.recipient,
        l.origin,
        l.notes,
        storageText(l),
        ...(l.tones ?? []),
        ...(keywordsByLetter[l.id] ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q.toLowerCase());
    });
    r = [...r].sort((a, b) => {
      const pick = (l: Letter) => {
        switch (sort.key) {
          case "date":
            return l.sort_date ?? l.normalized_date ?? "";
          case "storage":
            return storageText(l);
          default:
            return l[sort.key as keyof Letter];
        }
      };
      const av = String(pick(a) ?? "");
      const bv = String(pick(b) ?? "");
      if (av === bv) return (a.fh_seq - b.fh_seq) * sort.dir;
      // Blank values always sort last, so undated records never crowd the top.
      if (!av) return 1;
      if (!bv) return -1;
      return (av > bv ? 1 : -1) * sort.dir;
    });
    return r;
  }, [letters, q, period, tStatus, rType, review, scanF, catalogedOnly, uncertainOnly, idStatus, dStatus, digStatus, tones, view, sort, keywordsByLetter]);


  function exportRows() {
    return rows.map((l) => ({
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
      condition: l.physical_condition ?? "",
      physical_description: l.physical_description ?? "",
      original_copy: l.original_copy ?? "",
      identification_status: labelOf(IDENTIFICATION_STATUS, l.identification_status),
      storage_type: labelOf(STORAGE_TYPES, l.storage_type),
      storage_container: l.storage_container ?? "",
      storage_folder: l.storage_folder ?? "",
      storage_position: l.storage_position ?? "",
      storage_notes: l.storage_notes ?? "",
      storage_location: l.storage_location ?? "",
      research_status: l.research_status ?? "",

      digitization_status: labelOf(DIGITIZATION_STATUS, l.digitization_status ?? "not_scanned"),
      expected_scan_count: l.expected_scan_count ?? "",
      scan_status: l.scan_status,
      transcription_status: l.transcription_status,
      review_status: l.review_status,
      publication_status: l.publication_status,
      keywords: (keywordsByLetter[l.id] ?? []).join("; "),
      tones: (l.tones ?? []).join("; "),
      summary_short: l.summary_short ?? "",
      notes: l.notes ?? "",
      transcription_verified: l.transcription_verified ?? "",
      created_at: l.created_at,
      updated_at: l.updated_at,
    }));
  }
  const EXPORT_COLS = Object.keys(exportRows()[0] ?? { fh_id: "" });

  async function saveCell(letter: Letter, key: string, raw: string) {
    setEditing(null);
    const value = key === "sheets" ? (raw ? Number(raw) : null) : raw || null;
    if (String(letter[key as keyof Letter] ?? "") === String(value ?? "")) return;
    const { error } = await supabase.from("letters").update({ [key]: value } as never).eq("id", letter.id);
    if (error) return toast.error(error.message);
    await logEdits(letter.id, { [key]: letter[key as keyof Letter] }, { [key]: value });
    qc.invalidateQueries({ queryKey: ["letters"] });
  }

  function resetFilters() {
    setQ("");
    setPeriod("");
    setTStatus("");
    setRType("");
    setReview("");
    setScanF("");
    setCatalogedOnly(false);
    setUncertainOnly(false);
    setIdStatus("");
    setDStatus("");
    setDigStatus("");
    setTones([]);
    setView("");
    setSort({ key: "archive_id", dir: 1 });
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
    catalogedOnly ? "cataloged" : "",
    uncertainOnly ? "uncertain" : "",
    ...tones,
  ].filter(Boolean).length;

  function cellValue(l: Letter, key: string) {
    switch (key) {
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
        description={`${rows.length} of ${letters.length} records`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                download("harrington-archive.csv", toCsv(exportRows(), EXPORT_COLS), "text/csv")
              }
            >
              <Download className="size-4" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                download(
                  "harrington-archive.xls",
                  toExcelXml(exportRows(), EXPORT_COLS),
                  "application/vnd.ms-excel",
                )
              }
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


      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-secondary">
            <tr>
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
                {cols.map((c) => {
                  const isEditing = editing?.id === l.id && editing.key === c.key;
                  return (
                    <td
                      key={c.key}
                      className="truncate px-3 py-1.5 align-top"
                      style={{ maxWidth: widths[c.key] ?? c.width }}
                      onDoubleClick={() => c.editable && setEditing({ id: l.id, key: c.key })}
                    >
                      {c.key === "archive_id" ? (
                        <span className="inline-flex items-center gap-1.5">
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
        {rows.length === 0 && (
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
