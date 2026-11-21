import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, RotateCcw } from "lucide-react";
import { RecordGrid, gridCellClass, gridRowClass, gridSelectionClass, type GridSort } from "@/components/records/RecordGrid";
import { COLUMNS, DEFAULT_COLUMN_ORDER, COLUMN_ORDER_KEY } from "@/lib/record-columns";
import { normalizeColumnOrder } from "@/lib/column-order";
import { fetchAiStateForLetters, fetchKeywordsForLetters } from "@/lib/record-grid-data";
import { type CollectionRecord, collectionDate } from "@/lib/collections/model";
import { type Letter } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { DATE_PRECISION, IDENTIFICATION_STATUS, SCAN_STATUS, TRANSCRIPTION_STATUS, STORAGE_TYPES, displayDate, labelOf } from "@/lib/archive";
import { DIGITIZATION_STATUS } from "@/lib/digitization";
import { useRecordTypeOptions } from "@/lib/categories";
import { recordHealth } from "@/lib/record-health";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { CollectionLabels } from "./CollectionControls";
import { StarToggle } from "@/components/StarToggle";
import { DateLink } from "@/components/DateLink";
import { EmailArchiveDialog } from "@/components/letter/EmailArchiveDialog";
import { CopyShareLinkButton } from "@/components/letter/CopyShareLinkButton";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 100;
// Only display metadata; never load transcription bodies for a collection listing.
const LETTER_FIELDS = "id,archive_id,fh_seq,title,record_type,subtype,date_as_written,normalized_date,date_precision,date_certainty,date_end,date_from_postmark,identification_status,primary_person,author,recipient,origin,storage_type,storage_folder,sheets,image_count,has_envelope,digitization_status,scan_status,transcription_status,tones,notes,starred" as const;
async function fetchTableMetadata(ids: string[]) {
  const letters: Partial<Letter>[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from("letters").select(LETTER_FIELDS).in("id", ids.slice(i, i + 100));
    if (error) throw error;
    letters.push(...(data ?? []));
  }
  const [keywords, ai] = await Promise.all([fetchKeywordsForLetters(ids), fetchAiStateForLetters(ids)]);
  return { letters: new Map(letters.map(l => [l.id, l])), keywords, ai };
}

export function CollectionRecordTable({ records, selected, setSelected, collectionSort }: {
  records: CollectionRecord[];
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  collectionSort: string;
}) {
  const { canEdit, isAdmin } = useAuth();
  const recordTypes = useRecordTypeOptions();
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [compact, setCompact] = useState(false);
  const [sort, setSort] = useState<GridSort>({key:"date", dir:1});
  const [page, setPage] = useState(0);
  useEffect(() => {
    try {
      setColumnOrder(normalizeColumnOrder(JSON.parse(localStorage.getItem(COLUMN_ORDER_KEY) ?? "null"), DEFAULT_COLUMN_ORDER));
      const saved: Record<string, unknown> = JSON.parse(localStorage.getItem("letters_col_widths") ?? "{}");
      const restored: Record<string, number> = {};
      for (const c of COLUMNS) {
        const w = saved[c.key];
        if (typeof w === "number" && Number.isFinite(w)) restored[c.key] = Math.max(c.minWidth ?? 60, w);
      }
      setWidths(restored);
      const view = JSON.parse(localStorage.getItem("letters_view_state_v1") ?? "{}");
      if (Array.isArray(view.hidden)) setHidden(view.hidden.filter((key: unknown): key is string => typeof key === "string"));
      setCompact(view.compact === true);
    } catch { /* invalid or unavailable saved view */ }
  }, []);
  useEffect(() => {
    setSort({key:collectionSort === "number" ? "archive_id" : collectionSort === "title" ? "title" : "date", dir:collectionSort === "newest" ? -1 : 1});
  }, [collectionSort]);
  useEffect(() => { setPage(0); }, [records, sort]);
  const cols = columnOrder.flatMap(key => {
    const c = COLUMNS.find(col => col.key === key);
    return c && !hidden.includes(key) ? [c] : [];
  });
  const ids = records.filter(r => r.kind === "letter").map(r => r.ref_id);
  const { data, error } = useQuery({ queryKey:["collection-table-metadata", ids], queryFn:() => fetchTableMetadata(ids) });
  function saveColumnOrder(order: string[]) {
    setColumnOrder(order);
    try { localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order)); } catch { /* unavailable storage */ }
  }
  function value(r: CollectionRecord, key: string): string | number {
    const l = data?.letters.get(r.ref_id);
    if (key === "archive_id") return r.identifier;
    if (key === "title") return r.title ?? "";
    if (key === "date") return r.sort_date ?? "9999";
    if (key === "author" || key === "recipient" || key === "origin") return r[key] ?? "";
    if (key === "record_type") return l ? labelOf(recordTypes, l.record_type) : r.record_type ?? "";
    if (key === "keywords") return (data?.keywords[r.ref_id] ?? []).join(", ");
    if (!l) return "—";
    switch (key) {
      case "date_precision": return labelOf(DATE_PRECISION,l.date_precision);
      case "identification_status": return labelOf(IDENTIFICATION_STATUS,l.identification_status);
      case "storage": return [labelOf(STORAGE_TYPES,l.storage_type),l.storage_folder].filter(v => v && v !== "—").join(" · ");
      case "scan_status": return labelOf(SCAN_STATUS,l.scan_status);
      case "transcription_status": return labelOf(TRANSCRIPTION_STATUS,l.transcription_status);
      case "digitization_status": return labelOf(DIGITIZATION_STATUS,l.digitization_status);
      case "has_envelope": return l.has_envelope ? "Yes" : "No";
      case "tones": return (l.tones ?? []).join(", ");
      default: return String(l[key as keyof Letter] ?? "");
    }
  }
  const ordered = [...records].sort((a,b) => {
    const av = value(a,sort.key), bv = value(b,sort.key);
    return (String(av).localeCompare(String(bv),undefined,{numeric:true}) || a.identifier.localeCompare(b.identifier)) * sort.dir;
  });
  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const rows = ordered.slice(Math.min(page,pageCount-1) * PAGE_SIZE, (Math.min(page,pageCount-1)+1) * PAGE_SIZE);
  function select(r: CollectionRecord, on: boolean) {
    setSelected(prev => { const next = new Set(prev); const key = `${r.kind}:${r.ref_id}`; if (on) next.add(key); else next.delete(key); return next; });
  }
  return <>
    <div className="flex flex-wrap items-center gap-3 border-y border-border py-2 text-sm">
      <Button variant="outline" size="sm" disabled={page===0} onClick={() => setPage(p=>Math.max(0,p-1))}><ChevronLeft className="size-4" /> Prev</Button>
      <span className="tabular-nums text-muted-foreground">Page {page+1} of {pageCount} · {records.length} records</span>
      <Button variant="outline" size="sm" disabled={page+1>=pageCount} onClick={() => setPage(p=>p+1)}>Next <ChevronRight className="size-4" /></Button>
      <div className="ml-auto flex gap-2">
        <Button variant={compact ? "default":"outline"} size="sm" onClick={() => setCompact(v=>!v)}>Compact</Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Eye className="size-4" /> Columns</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{COLUMNS.map(c=><DropdownMenuCheckboxItem key={c.key} checked={!hidden.includes(c.key)} onCheckedChange={v=>setHidden(h=>v?h.filter(k=>k!==c.key):[...h,c.key])}>{c.label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
        <Button variant="outline" size="sm" onClick={()=>saveColumnOrder([...DEFAULT_COLUMN_ORDER])}><RotateCcw className="size-4" /> Reset columns</Button>
      </div>
    </div>
    {error && <p role="alert" className="text-destructive">{error.message}</p>}
    <RecordGrid cols={cols} widths={widths} setWidths={setWidths} columnOrder={columnOrder} saveColumnOrder={saveColumnOrder} sort={sort} setSort={setSort}
      selectionHeader={canEdit && <Checkbox aria-label="Select all records" checked={rows.length>0 && rows.every(r=>selected.has(`${r.kind}:${r.ref_id}`))} onCheckedChange={v=>rows.forEach(r=>select(r,Boolean(v)))} />}>
      {rows.map((r,i) => {
        const l = data?.letters.get(r.ref_id);
        return <tr key={`${r.kind}:${r.ref_id}`} className={gridRowClass(i,compact)}>
          <td className={gridSelectionClass(i,compact)}>{canEdit && <span className="relative z-10"><Checkbox aria-label={`Select ${r.identifier}`} checked={selected.has(`${r.kind}:${r.ref_id}`)} onCheckedChange={v=>select(r,Boolean(v))}/></span>}</td>
          {cols.map(c=><td key={c.key} className={gridCellClass(compact)} style={{width:widths[c.key] ?? c.width,maxWidth:widths[c.key] ?? c.width}}>
            {c.key === "archive_id" ? <span className="inline-flex flex-wrap items-center gap-1.5 [&>*]:shrink-0">
              {l && <StarToggle table="letters" id={r.ref_id} starred={Boolean(l.starred)} label={`${r.identifier} — ${r.title ?? ""}`} size="sm" className="size-6" />}
              {r.kind === "photo" ? <Link className="archive-id text-primary hover:underline" to="/photos/$phId" params={{phId:r.identifier}}>{r.identifier}</Link> : r.kind === "source" ? <Link className="archive-id text-primary hover:underline" to="/sources/$dsId" params={{dsId:r.identifier}}>{r.identifier}</Link> : <Link className="archive-id text-primary hover:underline" to="/letters/$archiveId" params={{archiveId:r.identifier}}>{r.identifier}</Link>}
              {l && <span title={recordHealth(l,data?.ai[r.ref_id]).label} aria-label={recordHealth(l,data?.ai[r.ref_id]).label} className="inline-block size-2.5 shrink-0 rounded-full border border-border" style={{backgroundColor:recordHealth(l,data?.ai[r.ref_id]).color}} />}
              {isAdmin && r.kind !== "photo" && <EmailArchiveDialog kind={r.kind} id={r.ref_id} identifier={r.identifier} title={r.title} trigger={<Button variant="ghost" size="icon" className="size-6" aria-label={`Email ${r.identifier}`}><Mail className="size-3" /></Button>} />}
              {isAdmin && r.kind === "letter" && <CopyShareLinkButton letterId={r.ref_id} className="size-6 rounded-full border border-border/60 bg-muted/40 p-0 text-muted-foreground hover:text-primary" />}
            </span> : c.key === "collections" ? <CollectionLabels record={{kind:r.kind,id:r.ref_id}} /> : c.key === "date" ? <DateLink date={r.sort_date}>{l?.date_precision && l.date_certainty ? displayDate({ normalized_date:l.normalized_date ?? null, date_precision:l.date_precision, date_certainty:l.date_certainty, date_as_written:l.date_as_written ?? null, date_end:l.date_end ?? null, date_from_postmark:l.date_from_postmark ?? false }) : collectionDate(r)}</DateLink> : <span className={cn((c.key==="author" || c.key==="recipient") && "record-party")}>{value(r,c.key)}</span>}
          </td>)}
        </tr>;
      })}
    </RecordGrid>
  </>;
}
