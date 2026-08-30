import logoMark from "@/assets/francis-files-logo.png";
import { useMemo, useState } from "react";
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
  CalendarClock,
  Hourglass,
  Shield,
  Globe,
  Paperclip,
  Sparkles,


  type LucideIcon,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchDashboardStats, type Letter } from "@/lib/queries";
import { fetchSources } from "@/lib/sources";
import { displayDate } from "@/lib/archive";
import { useRecordTypeOptions } from "@/lib/categories";
import { ArchiveNotes } from "@/components/ArchiveNotes";

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

export const Route = createFileRoute("/_authenticated/")({
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
  onClick,
  active,
}: {
  label: string;
  value: number;
  sub?: string;
  to?: string;
  tone?: Tone;
  icon?: LucideIcon;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:border-archive-gold/40 hover:shadow-lg ${
        active ? "border-archive-gold/60 ring-1 ring-archive-gold/40" : "border-border"
      }`}
    >
      <div className={`absolute top-0 left-0 h-full w-1.5 ${TONE_BAR[tone]}`} />
      <div className="mb-3 flex items-start gap-2.5">
        {Icon && (
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE_CHIP[tone]}`}
          >
            <Icon className="size-4" />
          </div>
        )}
        <span className="field-label whitespace-normal leading-5">{label}</span>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        {sub && (
          <p className="whitespace-normal text-center text-xs leading-relaxed text-muted-foreground">{sub}</p>
        )}
        <div className="font-display text-center text-3xl font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block h-full text-left">
        {body}
      </button>
    );
  }
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
  // All aggregate counts come from one database-side call — no table downloads.
  const { data: stats0, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
  });
  // Only the 8 newest records are fetched for the recent list.
  const { data: recent = [] } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letters")
        .select(
          "id, archive_id, title, author, recipient, origin, normalized_date, date_precision, date_as_written, date_certainty",
        )
        .order("fh_seq", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as Letter[];
    },
  });
  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const [dailyOpen, setDailyOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { data: daily } = useQuery({
    queryKey: ["daily-summary"],
    queryFn: fetchDailySummary,
  });

  const byType = stats0?.by_type ?? {};
  const byPeriod = stats0?.by_period ?? {};
  const typeOptions = useRecordTypeOptions();
  const categoryTiles = useMemo(() => {
    const known = new Set(typeOptions.map((o) => o.value));
    const style = (v: string): { tone: Tone; icon: LucideIcon } =>
      CATEGORY_STYLES[v] ?? { tone: "indigo", icon: Box };
    const tiles = typeOptions.map((o) => ({
      value: o.value,
      label: CATEGORY_LABELS[o.value] ?? o.label,
      count: byType[o.value] ?? 0,
      ...style(o.value),
    }));
    // Record types present in data but not in the options list get their own
    // tile instead of being lumped into "Other".
    for (const [value, count] of Object.entries(byType)) {
      if (!known.has(value)) {
        tiles.push({ value, label: value.replace(/_/g, " "), count, ...style(value) });
      }
    }
    return tiles;
  }, [byType, typeOptions]);

  const stats: { label: string; value: number; sub?: string; tone: Tone; icon: LucideIcon; to?: string }[] = [
    { label: "FH records", value: stats0?.total_records ?? 0, tone: "blue", icon: Hash, to: "/letters" },
    {
      label: "Digital sources",
      value: sources.length,
      tone: "teal",
      icon: Globe,
      to: "/sources",
    },

    {
      label: "Of extreme interest",
      value: (stats0?.starred_records ?? 0) + (stats0?.starred_sources ?? 0),
      tone: "amber",
      icon: Star,
      to: "/letters?starred=1",
    },
    { label: "Total scans", value: stats0?.total_scans ?? 0, tone: "emerald", icon: Layers, to: "/letters?scan=has" },
    {
      label: "Transcribed",
      value: stats0?.transcribed ?? 0,
      tone: "emerald",
      icon: FileCheck2,
      to: "/letters?tstatus=human_verified",
    },
    {
      label: "Needing transcription",
      value: stats0?.needs_transcription ?? 0,
      tone: "rose",
      icon: FileQuestion,
      to: "/letters?tstatus=!human_verified",
    },
    {
      label: "Uncertain dates",
      value: stats0?.uncertain_dates ?? 0,
      tone: "ochre",
      icon: CalendarClock,
      to: "/letters?uncertain=1",
    },
    { label: "Prewar", value: byPeriod["prewar"] ?? 0, tone: "plum", icon: Hourglass, to: "/letters?period=prewar" },
    { label: "Wartime", value: byPeriod["wartime"] ?? 0, tone: "rose", icon: Shield, to: "/letters?period=wartime" },
    {
      label: "Postwar",
      value: byPeriod["postwar"] ?? 0,
      tone: "indigo",
      icon: CalendarDays,
      to: "/letters?period=postwar",
    },
  ];

  return (
    <>
      <PageHeader
        title="Archive Dashboard"
        description="The Francis Files letters — cataloging status."
        center={
          <img
            src={logoMark}
            alt="The Francis Files"
            width={1024}
            height={1024}
            className="size-32 shrink-0 object-contain sm:size-40"
          />
        }
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
            <div className="grid auto-rows-fr grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              <Stat
                label="New today"
                value={(daily?.records ?? 0) + (daily?.dsRecords ?? 0)}
                tone="blue"
                icon={Sparkles}
                onClick={() => setDailyOpen((v) => !v)}
                active={dailyOpen}
              />
              {stats.map((s) => (
                <Stat key={s.label} {...s} />
              ))}
              <Stat
                label="All categories"
                value={categoryTiles.length}
                sub={categoriesOpen ? "Click to collapse" : "Click for more"}
                tone="plum"
                icon={Layers}
                onClick={() => setCategoriesOpen((v) => !v)}
                active={categoriesOpen}
              />
            </div>

            {dailyOpen && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="field-label">Daily summary — today</h2>
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="grid auto-rows-fr grid-cols-2 gap-4 md:grid-cols-4">
                  <Stat label="New FH records" value={daily?.records ?? 0} tone="blue" icon={Hash} />
                  <Stat label="New digital sources" value={daily?.dsRecords ?? 0} tone="teal" icon={Globe} />
                  <Stat label="Files uploaded" value={daily?.filesUploaded ?? 0} tone="amber" icon={Paperclip} />
                  <Stat label="Transcriptions generated" value={daily?.transcriptions ?? 0} tone="emerald" icon={PenLine} />
                </div>
              </div>
            )}

            {categoriesOpen && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="field-label">Record categories</h2>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setCategoriesOpen(false)}
                  >
                    Collapse
                  </button>
                </div>
                <div className="grid auto-rows-fr grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
              </div>
            )}

            <ArchiveNotes />


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
