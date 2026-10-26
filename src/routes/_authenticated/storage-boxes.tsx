import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Boxes, ChevronDown, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { displayDate, labelOf, STORAGE_TYPES } from "@/lib/archive";
import { condenseRanges } from "@/lib/box-ranges";
import { groupStorageBoxes, type StorageBoxRecord } from "@/lib/storage-boxes";

const storageBoxOptions = queryOptions({
  queryKey: ["storage-box-records"],
  queryFn: async () => {
    const records: StorageBoxRecord[] = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from("letters")
        .select("id, archive_id, fh_seq, title, record_type, storage_location, storage_type, storage_folder, normalized_date, date_end, date_as_written, date_precision, date_certainty, date_from_postmark")
        .order("fh_seq", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      records.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
    }
    return records;
  },
});

export const Route = createFileRoute("/_authenticated/storage-boxes")({
  head: () => ({ meta: [
    { title: "Storage Boxes — The Francis Files" },
    { name: "description", content: "Current storage boxes and the catalogued family records stored in each box." },
    { property: "og:title", content: "Storage Boxes — The Francis Files" },
    { property: "og:description", content: "Browse record counts and contents by current storage box in The Francis Files." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storageBoxOptions),
  pendingComponent: () => <AppShell><PageHeader title="Storage Boxes" /><p className="p-8 text-sm text-muted-foreground">Loading box contents…</p></AppShell>,
  errorComponent: ({ reset }) => <AppShell><PageHeader title="Storage Boxes" /><div className="space-y-3 p-8"><p>Box contents could not be loaded.</p><Button onClick={reset} variant="outline">Try again</Button></div></AppShell>,
  component: () => <AppShell><StorageBoxes /></AppShell>,
});

function StorageBoxes() {
  const { data: records } = useSuspenseQuery(storageBoxOptions);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupStorageBoxes(records), [records]);
  const needle = search.trim().toLowerCase();
  const visible = groups.map((group) => ({
    ...group,
    matches: !needle || (group.name || "No box assigned").toLowerCase().includes(needle)
      ? group.records
      : group.records.filter((r) => [r.archive_id, r.title, r.record_type, r.storage_folder].some((v) => v?.toLowerCase().includes(needle))),
  })).filter((group) => group.matches.length > 0);
  const boxCount = groups.filter((g) => g.name).length;
  const assignedCount = groups.filter((g) => g.name).reduce((sum, g) => sum + g.records.length, 0);

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return <>
    <PageHeader title="Storage Boxes" description={`${boxCount} boxes · ${assignedCount} records assigned · ${records.length - assignedCount} without a box`}
      actions={<Button asChild variant="outline" size="sm"><Link to="/letters">All Records</Link></Button>} />
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-8">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search storage boxes and records" placeholder="Search boxes, FH numbers or titles…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set(visible.map((g) => g.name)))}>Expand all</Button>
      <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>Collapse all</Button>
    </div>
    <div className="px-4 py-4 sm:px-8">
      {visible.length === 0 && <p className="py-8 text-sm text-muted-foreground">{records.length ? "No boxes or records match this search." : "No records yet."}</p>}
      {visible.map((group) => {
        const open = expanded.has(group.name) || Boolean(needle);
        return <section key={group.name} className="border-b border-border">
          <h2>
            <Button variant="ghost" className="h-auto w-full justify-start gap-3 rounded-none px-0 py-4 text-left whitespace-normal hover:bg-muted/40" aria-expanded={open} aria-controls={`box-${group.records[0]?.id}`} onClick={() => toggle(group.name)}>
              <Boxes className="size-5 shrink-0 text-archive-gold" />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-display text-lg font-semibold">{group.name || "No box assigned"}</span>
                <span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{condenseRanges(group.records.map((r) => r.archive_id))}</span>
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">{group.records.length} {group.records.length === 1 ? "record" : "records"}</span>
              <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
          </h2>
          {open && <div id={`box-${group.records[0]?.id}`} className="pb-4">
            {needle && group.matches.length !== group.records.length && <p className="pb-2 text-xs text-muted-foreground">{group.matches.length} matching records</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] table-fixed text-left text-sm">
                <colgroup><col className="w-28" /><col className="w-48" /><col /><col className="w-44" /></colgroup>
                <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-2 py-2">FH record</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">Title</th><th className="px-2 py-2">Storage</th></tr></thead>
                <tbody>{group.matches.map((record) => <tr key={record.id} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="px-2 py-2 align-top"><Link to="/letters/$archiveId" params={{ archiveId: record.archive_id }} className="archive-id text-primary hover:underline">{record.archive_id}</Link></td>
                  <td className="px-2 py-2 align-top whitespace-nowrap">{displayDate(record)}</td>
                  <td className="max-w-md px-2 py-2 align-top break-words"><Link to="/letters/$archiveId" params={{ archiveId: record.archive_id }} className="hover:text-primary hover:underline">{record.title || "Untitled"}</Link></td>
                  <td className="px-2 py-2 align-top text-muted-foreground">{[labelOf(STORAGE_TYPES, record.storage_type), record.storage_folder].filter((v) => v && v !== "—").join(" · ") || "—"}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>}
        </section>;
      })}
    </div>
  </>;
}