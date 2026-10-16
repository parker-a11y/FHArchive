import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Letter } from "@/lib/archive";
import { displayDate } from "@/lib/archive";

const EXACT_SKIP = new Set(["year", "month", "unknown", "not_applicable", "undated"]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Seven calendar days starting at `start`, as {md: "MM-DD", label, weekday}. */
export function weekDays(start: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return { md: `${mm}-${dd}`, label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, weekday: WEEKDAYS[d.getDay()] };
  });
}

export function WeekInHistory({ letters }: { letters: Letter[] }) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const days = useMemo(() => {
    const t = new Date();
    return weekDays(new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset * 7));
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

  const total = days.reduce((n, d) => n + (byDay[d.md]?.length ?? 0), 0);

  return (
    <section className="border-b border-border px-4 py-4 sm:px-8">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">
            This week in Francis Files history
          </h2>
          <p className="text-xs text-muted-foreground">
            {days[0].label} – {days[6].label}, any year · {total} record{total === 1 ? "" : "s"}
          </p>
        </div>
        <button aria-label="Previous week" onClick={() => setOffset((o) => o - 1)} className="rounded border border-border p-1 hover:bg-muted">
          <ChevronLeft className="size-4" />
        </button>
        {offset !== 0 && (
          <button onClick={() => setOffset(0)} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">
            This week
          </button>
        )}
        <button aria-label="Next week" onClick={() => setOffset((o) => o + 1)} className="rounded border border-border p-1 hover:bg-muted">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-7">
        {days.map((d, i) => {
          const items = byDay[d.md] ?? [];
          return (
            <div key={d.md} className={`rounded-lg border p-2 ${i === 0 && offset === 0 ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              <div className="mb-1 flex items-baseline justify-between gap-1">
                <span className="text-xs font-semibold">{d.label}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{d.weekday}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-1">
                  {items.map((l) => {
                    const isOpen = open === l.id;
                    return (
                      <li key={l.id} className="rounded bg-muted/50 text-xs">
                        <button onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full items-start gap-1 p-1.5 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="archive-id block text-[10px] text-primary">
                              {l.archive_id} · {l.normalized_date!.slice(0, 4)}
                            </span>
                            <span className="line-clamp-2 font-medium">{l.title || `${l.author || "—"} → ${l.recipient || "—"}`}</span>
                          </span>
                          <ChevronDown className={`mt-0.5 size-3 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
