import { useMemo } from "react";
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
  Images,
  PenLine,
  FileCheck2,
  FileQuestion,
  Eye,
  CalendarClock,
  Hourglass,
  Shield,
  Globe,
  Paperclip,

  type LucideIcon,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchLetters, fetchItemCounts, type Letter } from "@/lib/queries";
import { fetchDsFileCounts, fetchSources } from "@/lib/sources";
import { displayDate } from "@/lib/archive";
import { useRecordTypeOptions } from "@/lib/categories";

/** Tone/icon per built-in record type; anything else falls back to Box/indigo. */
const CATEGORY_STYLES: Record<string, { tone: Tone; icon: LucideIcon }> = {
  letter: { tone: "blue", icon: Mail },
  photograph: { tone: "emerald", icon: Camera },
  military: { tone: "rose", icon: Medal },
  government: { tone: "indigo", icon: Landmark },
  family: { tone: "amber", icon: Home },
  newspaper: { tone: "teal", icon: Newspaper },
  financial: { tone: "ochre", icon: Coins },
  program: { tone: "plum", icon: CalendarDays },
  artifact: { tone: "rose", icon: Gem },
  other: { tone: "indigo", icon: Box },
};

/** Shorter dashboard labels for a few built-ins. */
const CATEGORY_LABELS: Record<string, string> = {
  letter: "Letters",
  photograph: "Photographs",
  military: "Military",
  government: "Government",
  family: "Personal / Family",
  newspaper: "Newspaper",
  financial: "Financial",
  program: "Programs",
  artifact: "Artifacts",
};

async function fetchDailySummary() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const iso = start.toISOString();
  const count = async (
    table: "letters" | "digital_sources" | "digital_files" | "ds_files" | "container_files" | "scan_transcriptions",
    column = "created_at",
  ) => {
    const { count: n } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .gte(column, iso);
    return n ?? 0;
  };
  const [records, dsRecords, scans, dsFiles, containerPhotos, transcriptions] = await Promise.all([
    count("letters"),
    count("digital_sources"),
    count("digital_files"),
    count("ds_files"),
    count("container_files"),
    count("scan_transcriptions"),
  ]);
  return {
    records,
    dsRecords,
    filesUploaded: scans + dsFiles + containerPhotos,
    transcriptions,
  };
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — The Francis Files" },
      {
        name: "description",
        content:
          "Cataloging status overview for The Francis Files collection: scanning, transcription and review progress.",
      },
      { property: "og:title", content: "Dashboard — The Francis Files" },
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
  sub,
  to,
  tone = "amber",
  icon: Icon,
}: {
  label: string;
  value: number;
  sub?: string;
  to?: string;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  const body = (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-archive-gold/40 hover:shadow-lg">
      <div className={`absolute top-0 left-0 h-full w-1.5 ${TONE_BAR[tone]}`} />
      <div className="mb-3 flex items-start gap-2.5">
        {Icon && (
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[tone]}`}
          >
            <Icon className="size-4" />
          </div>
        )}
        <span className="field-label line-clamp-2 h-10 leading-5">{label}</span>
      </div>
      <div className="font-display text-3xl font-bold tabular-nums">{value}</div>
      {sub && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
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
  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const { data: dsFileCounts = {} } = useQuery({
    queryKey: ["ds-file-counts"],
    queryFn: fetchDsFileCounts,
  });
  const { data: daily } = useQuery({
    queryKey: ["daily-summary"],
    queryFn: fetchDailySummary,
  });

  const typeOptions = useRecordTypeOptions();
  const categoryTiles = useMemo(() => {
    const known = new Set(typeOptions.map((o) => o.value));
    const counts = new Map<string, number>();
    for (const l of letters) {
      const raw = (l.record_type as string) || "letter";
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    const style = (v: string): { tone: Tone; icon: LucideIcon } =>
      CATEGORY_STYLES[v] ?? { tone: "indigo", icon: Box };
    const tiles = typeOptions.map((o) => ({
      value: o.value,
      label: CATEGORY_LABELS[o.value] ?? o.label,
      count: counts.get(o.value) ?? 0,
      ...style(o.value),
    }));
    // Record types present in data but not in the options list get their own
    // tile instead of being lumped into "Other".
    for (const [value, count] of counts) {
      if (!known.has(value)) {
        tiles.push({ value, label: value.replace(/_/g, " "), count, ...style(value) });
      }
    }
    return tiles;
  }, [letters, typeOptions]);

  const c = (fn: (l: Letter) => boolean) => letters.filter(fn).length;
  const stats: { label: string; value: number; sub?: string; tone: Tone; icon: LucideIcon; to?: string }[] = [
    { label: "FH records", value: letters.length, tone: "blue", icon: Hash, to: "/letters" },
    {
      label: "Digital sources",
      value: sources.length,
      tone: "teal",
      icon: Globe,
      to: "/sources",
    },

    { label: "Total scans", value: itemCounts?.totalScans ?? 0, tone: "emerald", icon: Layers, to: "/letters?scan=has" },
    {
      label: "Transcribed",
      value: c((l) => l.transcription_status === "human_verified"),
      tone: "emerald",
      icon: FileCheck2,
      to: "/letters?tstatus=human_verified",
    },
    {
      label: "Needing transcription",
      value: c((l) => l.transcription_status !== "human_verified"),
      tone: "rose",
      icon: FileQuestion,
      to: "/letters?tstatus=!human_verified",
    },
    {
      label: "Reviewed",
      value: c((l) => l.review_status === "reviewed"),
      tone: "indigo",
      icon: Eye,
      to: "/letters?review=reviewed",
    },
    {
      label: "Uncertain dates",
      value: c((l) => l.date_certainty !== "confirmed" || l.date_precision !== "exact"),
      tone: "ochre",
      icon: CalendarClock,
      to: "/letters?uncertain=1",
    },
    { label: "Prewar", value: c((l) => l.period === "prewar"), tone: "plum", icon: Hourglass, to: "/letters?period=prewar" },
    { label: "Wartime", value: c((l) => l.period === "wartime"), tone: "rose", icon: Shield, to: "/letters?period=wartime" },
    {
      label: "Postwar",
      value: c((l) => l.period === "postwar"),
      tone: "indigo",
      icon: CalendarDays,
      to: "/letters?period=postwar",
    },
  ];

  const recent = [...letters].sort((a, b) => b.fh_seq - a.fh_seq).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Archive Dashboard"
        description="The Francis Files letters — cataloging status."
        actions={
          <Button
            size="lg"
            className="gap-2 rounded-full px-6 shadow-lg transition-all hover:shadow-xl active:scale-95"
            onClick={() => navigate({ to: "/catalog" })}
          >
            <Plus className="size-4 text-archive-gold" /> ADD NEXT ARCHIVE ITEM
          </Button>
        }
      />
      <div className="p-4 sm:p-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {stats.map((s) => (
                <Stat key={s.label} {...s} />
              ))}
            </div>

            <div className="mt-10 mb-3 flex items-baseline justify-between">
              <h2 className="field-label">Daily summary — today</h2>
              <span className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="New FH records" value={daily?.records ?? 0} tone="blue" icon={Hash} />
              <Stat label="New digital sources" value={daily?.dsRecords ?? 0} tone="teal" icon={Globe} />
              <Stat label="Files uploaded" value={daily?.filesUploaded ?? 0} tone="amber" icon={Paperclip} />
              <Stat label="Transcriptions generated" value={daily?.transcriptions ?? 0} tone="emerald" icon={PenLine} />
            </div>

            <h2 className="field-label mt-10 mb-3">Record categories</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {categoryTiles.map((cat) => (
                <Stat
                  key={cat.value}
                  label={cat.label}
                  value={cat.count}
                  to={`/letters?type=${cat.value}`}
                  tone={cat.tone}
                  icon={cat.icon}
                />
              ))}
            </div>

            <h2 className="field-label mt-10 mb-3">Recently added</h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="divide-y divide-border">
                {recent.length === 0 && (
                  <p className="px-5 py-6 text-sm text-muted-foreground">
                    No records yet. Start with Quick Entry.
                  </p>
                )}
                {recent.map((l) => (
                  <Link
                    key={l.id}
                    to="/letters/$archiveId"
                    params={{ archiveId: l.archive_id }}
                    className="flex items-center gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tone-amber-soft text-tone-amber">
                      <Mail className="size-4" />
                    </div>
                    <span className="archive-id w-24 text-base">{l.archive_id}</span>
                    <span className="w-36 text-muted-foreground">{displayDate(l)}</span>
                    <span className="truncate font-medium">
                      {l.title || `${l.author || "—"} → ${l.recipient || "—"}`}
                    </span>
                    <span className="ml-auto text-muted-foreground">{l.origin}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
