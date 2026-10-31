import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Letter } from "@/lib/queries";
import { displayDate } from "@/lib/archive";

const EXACT_SKIP = new Set(["year", "month", "unknown", "not_applicable", "undated"]);
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Calendar cells for a month: 42 days starting on the Sunday of the first week. */
function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return { md: `${mm}-${dd}`, day: d.getDate(), inMonth: d.getMonth() === month };
  });
}

export function MonthInHistory({ letters }: { letters: Letter[] }) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const { year, month, cells } = useMemo(() => {
    const t = new Date();
    const base = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    return { year: base.getFullYear(), month: base.getMonth(), cells: monthCells(base.getFullYear(), base.getMonth()) };
  }, [offset]);

  const byDay = useMemo(() => {
    const map: Record<string, Letter[]> = {};
    for (const l of letters) {
      if (!l.normalized_date || EXACT_SKIP.has(l.date_precision)) continue;
      (map[l.normalized_date.slice(5, 10)] ??= []).push(l);
    }
    for (const k in map) map[k].sort((a, b) => (a.normalized_date! < b.normalized_date! ? -1 : 1));
    return map;
  }, [letters]);

  const total = cells.reduce((n, c) => n + (c.inMonth ? (byDay[c.md]?.length ?? 0) : 0), 0);
  const todayMd = (() => {
    const t = new Date();
    return `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  return (
    <section className="border-b border-border px-4 py-4 sm:px-8">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">
            {MONTHS[month]} in Francis Files history
          </h2>
          <p className="text-xs text-muted-foreground">
            {MONTHS[month]}, any year · {total} record{total === 1 ? "" : "s"}
          </p>
        </div>
        <button aria-label="Previous month" onClick={() => setOffset((o) => o - 1)} className="rounded border border-border p-1 hover:bg-muted">
          <ChevronLeft className="size-4" />
        </button>
        {offset !== 0 && (
          <button onClick={() => setOffset(0)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">
            This month
          </button>
        )}
        <button aria-label="Next month" onClick={() => setOffset((o) => o + 1)} className="rounded border border-border p-1 hover:bg-muted">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          const items = c.inMonth ? (byDay[c.md] ?? []) : [];
          const isToday = c.md === todayMd && c.inMonth && offset === 0;
          return (
            <div
              key={i}
              className={`min-h-16 rounded border p-1 ${
                !c.inMonth
                  ? "border-transparent bg-transparent"
                  : isToday
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
              }`}
            >
              {c.inMonth && (
                <>
                  <div className="mb-0.5 text-[10px] font-semibold text-muted-foreground">{c.day}</div>
                  {items.length > 0 && (
                    <ul className="space-y-0.5">
                      {items.map((l) => {
                        const isOpen = open === l.id;
                        return (
                          <li key={l.id} className="rounded bg-muted/50 text-[11px]">
                            <button onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full items-start gap-0.5 p-1 text-left">
                              <span className="min-w-0 flex-1">
                                <span className="archive-id block text-[9px] text-primary">
                                  {l.archive_id} · {l.normalized_date!.slice(0, 4)}
                                </span>
                                <span className="line-clamp-2 font-medium">{l.title || `${l.author || "—"} → ${l.recipient || "—"}`}</span>
                              </span>
                              <ChevronDown className={`mt-0.5 size-2.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                            {isOpen && (
                              <div className="space-y-1 border-t border-border p-1.5 text-muted-foreground">
                                <p>{displayDate(l)}</p>
                                <p>{l.author || "—"} → {l.recipient || "—"}{l.origin ? ` · ${l.origin}` : ""}</p>
                                {l.summary_short && <p className="text-foreground">{l.summary_short}</p>}
                                <Link to="/letters/$archiveId" params={{ archiveId: l.archive_id }} className="inline-block font-medium text-primary hover:underline">
                                  Open record →
                                </Link>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
