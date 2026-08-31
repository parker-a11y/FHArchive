import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  searchArchiveRecords,
  type ArchiveRecordRef,
  type RecordKind,
} from "@/lib/record-links";
import { cn } from "@/lib/utils";

/**
 * Archive-wide record search. Searches every collection (physical FH records
 * and Digital Archive records) by ID, title, date, type, people, keywords,
 * events, description and transcription text.
 */
export function RelatedRecordsPicker({
  exclude = [],
  onPick,
  placeholder = "Search the whole archive — ID, title, date, person, keyword, text…",
  className,
}: {
  exclude?: Array<{ kind: RecordKind; id: string }>;
  onPick: (record: ArchiveRecordRef) => void;
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data = [], isFetching } = useQuery({
    queryKey: ["archiveRecordSearch", debounced],
    queryFn: () => searchArchiveRecords(debounced, 25),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });

  const excluded = new Set(exclude.map((e) => `${e.kind}:${e.id}`));
  const results = data.filter((r) => !excluded.has(`${r.kind}:${r.id}`));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {debounced && (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card">
          {isFetching && !results.length && (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          )}
          {!isFetching && !results.length && (
            <p className="p-3 text-sm text-muted-foreground">No matching archive records.</p>
          )}
          {results.map((r) => (
            <button
              key={`${r.kind}:${r.id}`}
              type="button"
              onClick={() => {
                onPick(r);
                setQ("");
                setDebounced("");
              }}
              className="block w-full border-b border-border/60 px-3 py-2 text-left last:border-0 hover:bg-muted/60"
            >
              <div className="text-sm">
                <span className="archive-id">{r.ref}</span>
                {r.title ? <span> — {r.title}</span> : null}
                {r.date_text ? (
                  <span className="text-muted-foreground"> · {r.date_text}</span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.collection}
                {r.type_label ? ` · ${r.type_label}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
