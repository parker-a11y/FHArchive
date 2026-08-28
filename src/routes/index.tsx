import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Mail,
  Camera,
  Medal,
  Landmark,
  Home,
  Newspaper,
  Coins,
  CalendarDays,
  Gem,
  Box,
  Hash,
  Layers,
  ScanLine,
  Images,
  PenLine,
  FileCheck2,
  FileQuestion,
  Eye,
  CalendarClock,
  ImageOff,
  Hourglass,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { fetchLetters, fetchItemCounts, type Letter } from "@/lib/queries";
import { displayDate, RECORD_TYPES } from "@/lib/archive";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Harrington Letter Archive" },
      {
        name: "description",
        content:
          "Cataloging status overview for the Harrington family letter collection: scanning, transcription and review progress.",
      },
      { property: "og:title", content: "Dashboard — Harrington Letter Archive" },
      {
        property: "og:description",
        content: "Cataloging, scanning and transcription progress across the letter collection.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

type Tone = "blue" | "emerald" | "amber" | "indigo" | "rose" | "teal" | "ochre" | "plum";

const TONE_BAR: Record<Tone, string> = {
  blue: "bg-tone-blue",
  emerald: "bg-tone-emerald",
  amber: "bg-tone-amber",
  indigo: "bg-tone-indigo",
  rose: "bg-tone-rose",
  teal: "bg-tone-teal",
  ochre: "bg-tone-ochre",
  plum: "bg-tone-plum",
};
const TONE_CHIP: Record<Tone, string> = {
  blue: "bg-tone-blue-soft text-tone-blue",
  emerald: "bg-tone-emerald-soft text-tone-emerald",
  amber: "bg-tone-amber-soft text-tone-amber",
  indigo: "bg-tone-indigo-soft text-tone-indigo",
  rose: "bg-tone-rose-soft text-tone-rose",
  teal: "bg-tone-teal-soft text-tone-teal",
  ochre: "bg-tone-ochre-soft text-tone-ochre",
  plum: "bg-tone-plum-soft text-tone-plum",
};

function Stat({
  label,
  value,
  to,
  tone = "amber",
  icon: Icon,
}: {
  label: string;
  value: number;
  to?: string;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  const body = (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-archive-gold/40 hover:shadow-lg">
      <div className={`absolute top-0 left-0 h-full w-1.5 ${TONE_BAR[tone]}`} />
      <div className="mb-3 flex items-center gap-2.5">
        {Icon && (
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[tone]}`}
          >
            <Icon className="size-4" />
          </div>
        )}
        <span className="field-label">{label}</span>
      </div>
      <div className="font-display text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { data: letters = [], isLoading } = useQuery({
    queryKey: ["letters"],
    queryFn: fetchLetters,
  });
  const { data: itemCounts } = useQuery({
    queryKey: ["item-counts"],
    queryFn: fetchItemCounts,
  });

  const c = (fn: (l: Letter) => boolean) => letters.filter(fn).length;
  const stats: { label: string; value: number; tone: Tone; icon: LucideIcon }[] = [
    { label: "FH records", value: letters.length, tone: "blue", icon: Hash },
    { label: "Total items", value: itemCounts?.totalItems ?? 0, tone: "emerald", icon: Layers },
    { label: "Items scanned", value: itemCounts?.itemsScanned ?? 0, tone: "teal", icon: ScanLine },
    { label: "Total scans", value: itemCounts?.totalScans ?? 0, tone: "teal", icon: Images },
    {
      label: "Cataloged",
      value: c((l) => !!(l.author || l.recipient || l.normalized_date)),
      tone: "amber",
      icon: PenLine,
    },
    {
      label: "Records with scans",
      value: c((l) => l.image_count > 0),
      tone: "teal",
      icon: FileCheck2,
    },
    {
      label: "Transcribed",
      value: c((l) => l.transcription_status === "human_verified"),
      tone: "emerald",
      icon: FileCheck2,
    },
    {
      label: "Needing transcription",
      value: c((l) => l.transcription_status !== "human_verified"),
      tone: "rose",
      icon: FileQuestion,
    },
    {
      label: "Reviewed",
      value: c((l) => l.review_status === "reviewed"),
      tone: "indigo",
      icon: Eye,
    },
    {
      label: "Uncertain dates",
      value: c((l) => l.date_certainty !== "confirmed" || l.date_precision !== "exact"),
      tone: "ochre",
      icon: CalendarClock,
    },
    {
      label: "Records missing scans",
      value: c((l) => l.image_count === 0),
      tone: "rose",
      icon: ImageOff,
    },
    { label: "Prewar", value: c((l) => l.period === "prewar"), tone: "plum", icon: Hourglass },
    { label: "Wartime", value: c((l) => l.period === "wartime"), tone: "rose", icon: Shield },
    {
      label: "Postwar",
      value: c((l) => l.period === "postwar"),
      tone: "indigo",
      icon: CalendarDays,
    },
  ];

  const recent = [...letters].sort((a, b) => b.fh_seq - a.fh_seq).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Archive Dashboard"
        description="Harrington family letters — cataloging status."
        actions={
          <Button size="lg" className="gap-2" onClick={() => navigate({ to: "/catalog" })}>
            <Plus className="size-4" /> ADD NEXT ARCHIVE ITEM
          </Button>
        }
      />
      <div className="p-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {stats.map((s) => (
                <Stat key={s.label} {...s} />
              ))}
            </div>

            <h2 className="field-label mt-10 mb-3">Record categories</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {[
                { value: "letter", label: "Letters" },
                { value: "photograph", label: "Photographs" },
                { value: "military", label: "Military" },
                { value: "government", label: "Government" },
                { value: "family", label: "Personal / Family" },
                { value: "newspaper", label: "Newspaper" },
                { value: "financial", label: "Financial" },
                { value: "program", label: "Programs" },
                { value: "artifact", label: "Artifacts" },
                { value: "other", label: "Other" },
              ].map((cat) => (
                <Stat
                  key={cat.value}
                  label={cat.label}
                  value={letters.filter((l) => (l.record_type ?? "letter") === cat.value).length}
                  to={`/letters?type=${cat.value}`}
                />
              ))}
            </div>

            <h2 className="field-label mt-10 mb-3">Recently added</h2>
            <div className="divide-y divide-border rounded border border-border bg-card">
              {recent.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No letters yet. Start with Quick Entry.
                </p>
              )}
              {recent.map((l) => (
                <Link
                  key={l.id}
                  to="/letters/$archiveId"
                  params={{ archiveId: l.archive_id }}
                  className="flex items-center gap-6 px-4 py-2.5 text-sm hover:bg-muted/60"
                >
                  <span className="archive-id w-28 text-base">{l.archive_id}</span>
                  <span className="w-40 text-muted-foreground">{displayDate(l)}</span>
                  <span className="truncate">
                    {l.author || "—"} → {l.recipient || "—"}
                  </span>
                  <span className="ml-auto text-muted-foreground">{l.origin}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
