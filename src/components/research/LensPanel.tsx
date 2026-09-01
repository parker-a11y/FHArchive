import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, MapPin, Users } from "lucide-react";
import { researchLens } from "@/lib/research.functions";

type LensKey = "timeline" | "people" | "map" | "themes" | "contradictions";
type LensData = Awaited<ReturnType<typeof researchLens>>;

const CONFIDENCE_TONE: Record<string, string> = {
  confirmed: "bg-tone-emerald-soft text-tone-emerald",
  "highly likely": "bg-tone-teal-soft text-tone-teal",
  probable: "bg-tone-blue-soft text-tone-blue",
  possible: "bg-tone-amber-soft text-tone-amber",
  uncertain: "bg-tone-rose-soft text-tone-rose",
};

/** Links an FH / DS number to its record page. */
function RecordLink({ id }: { id: string }) {
  return id.startsWith("DS") ? (
    <Link
      to="/sources/$dsId"
      params={{ dsId: id }}
      className="archive-id text-archive-gold hover:underline"
    >
      {id}
    </Link>
  ) : (
    <Link
      to="/letters/$archiveId"
      params={{ archiveId: id }}
      className="archive-id text-archive-gold hover:underline"
    >
      {id}
    </Link>
  );
}

/** A simple proportional bar used by the theme and place lists. */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="ml-auto flex items-center gap-2">
      <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
        <span
          className="block h-full rounded-full bg-archive-gold/70"
          style={{ width: `${Math.max(6, Math.round((value / max) * 100))}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {value}
      </span>
    </span>
  );
}

export function LensPanel({ lens }: { lens: LensKey }) {
  const fetchLens = useServerFn(researchLens);
  const { data, isLoading, error } = useQuery<LensData>({
    queryKey: ["research-lens", lens],
    queryFn: () => fetchLens({ data: { lens } }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-4 animate-spin" /> Reading the research index…
      </div>
    );

  if (error)
    return (
      <p className="rounded-2xl border border-border bg-card p-5 text-sm text-tone-rose shadow-sm">
        {(error as Error).message}
      </p>
    );

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      {data.lens === "timeline" && <TimelineLens data={data} />}
      {data.lens === "people" && <PeopleLens data={data} />}
      {data.lens === "map" && <MapLens data={data} />}
      {data.lens === "themes" && <ThemesLens data={data} />}
      {data.lens === "contradictions" && <ContradictionsLens data={data} />}
    </div>
  );
}

type Of<K extends LensKey> = Extract<LensData, { lens: K }>;

function TimelineLens({ data }: { data: Of<"timeline"> }) {
  if (data.groups.length === 0)
    return <Empty text="No dated records in the research snapshot yet." />;
  return (
    <>
      <Header
        title="Chronology"
        note={`${data.total - data.undated} dated records across ${data.groups.length} years · ${data.undated} undated`}
      />
      <div className="mt-4 space-y-6">
        {data.groups.map((g) => (
          <div key={g.year}>
            <div className="mb-2 flex items-baseline gap-3">
              <span className="font-display text-lg font-semibold">{g.year}</span>
              <span className="text-xs text-muted-foreground">{g.count} records</span>
            </div>
            <ol className="space-y-1 border-l border-border pl-4">
              {g.items.map((i) => (
                <li key={i.archive_id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-2 size-1.5 rounded-full bg-archive-gold" />
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <RecordLink id={i.archive_id} />
                    <span className="text-xs text-muted-foreground">{i.date}</span>
                    <span className="text-foreground">{i.title || "Untitled"}</span>
                    {i.origin && (
                      <span className="text-xs text-muted-foreground">· {i.origin}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}

function PeopleLens({ data }: { data: Of<"people"> }) {
  if (data.nodes.length === 0) return <Empty text="No people are indexed yet." />;
  const max = data.nodes[0]!.count;
  return (
    <>
      <Header
        title="People network"
        note={`${data.nodes.length} most-present people across ${data.pairsFrom} records`}
      />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="field-label mb-2">Most present</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {data.nodes.map((n) => (
              <li key={n.name} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Users className="size-3.5 shrink-0 text-muted-foreground" />
                <span>{n.name}</span>
                <Bar value={n.count} max={max} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="field-label mb-2">Appear together</p>
          {data.edges.length === 0 ? (
            <Empty text="No two indexed people share a record yet." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {data.edges.map((e) => (
                <li key={`${e.a}|${e.b}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span>{e.a}</span>
                  <span className="text-muted-foreground">—</span>
                  <span>{e.b}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {e.count} record{e.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function MapLens({ data }: { data: Of<"map"> }) {
  if (data.places.length === 0) return <Empty text="No places are indexed yet." />;
  const max = data.places[0]!.count;
  return (
    <>
      <Header
        title="Geography"
        note={`${data.places.length} places · ${data.routes.length} origin-to-destination routes`}
      />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="field-label mb-2">Places by presence</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {data.places.map((p) => (
              <li key={p.name} className="px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <MapPin className="size-3.5 shrink-0 text-archive-gold" />
                  {p.name}
                  <Bar value={p.count} max={max} />
                </span>
                <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 pl-5">
                  {p.ids.map((id) => (
                    <RecordLink key={id} id={id} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="field-label mb-2">Routes</p>
          {data.routes.length === 0 ? (
            <Empty text="No record records both an origin and a destination yet." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {data.routes.map((r) => (
                <li key={`${r.from}|${r.to}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span>{r.from}</span>
                  <span className="text-archive-gold">→</span>
                  <span>{r.to}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ThemesLens({ data }: { data: Of<"themes"> }) {
  const columns: { label: string; rows: { name: string; count: number }[] }[] = [
    { label: "Keywords", rows: data.keywords },
    { label: "Tone / sentiment", rows: data.tones },
    { label: "Record types", rows: data.types },
  ];
  if (columns.every((c) => c.rows.length === 0))
    return <Empty text="No keywords or tones are indexed yet." />;
  return (
    <>
      <Header title="Theme analysis" note={`Across ${data.total} indexed records`} />
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.label}>
            <p className="field-label mb-2">{col.label}</p>
            {col.rows.length === 0 ? (
              <Empty text="Nothing recorded yet." />
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {col.rows.map((r) => (
                  <li key={r.name} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="truncate capitalize">{r.name.replace(/_/g, " ")}</span>
                    <Bar value={r.count} max={col.rows[0]!.count} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function ContradictionsLens({ data }: { data: Of<"contradictions"> }) {
  return (
    <>
      <Header
        title="Contradictions"
        note={`${data.checked} records reviewed · AI interpretation, not catalog fact`}
      />
      {data.items.length === 0 ? (
        <div className="mt-4">
          <Empty text="No internal contradictions surfaced in the current snapshot." />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.items.map((c, i) => (
            <li key={i} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="size-4 text-tone-amber" />
                <span className="font-medium">{c.issue}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    CONFIDENCE_TONE[c.confidence] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.confidence}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.detail}</p>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {c.records.map((id) => (
                  <RecordLink key={id} id={id} />
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Header({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</p>;
}
