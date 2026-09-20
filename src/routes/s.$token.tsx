import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpenText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSharedRecord } from "@/lib/shares.functions";
import { RECORD_TYPES, labelOf } from "@/lib/archive";
import { FfnText } from "@/components/ffn/FfnText";
import { RichTextView } from "@/components/RichTextView";
import { isRichHtml } from "@/lib/rich-text";
import { yearFromDate } from "@/lib/money";

export const Route = createFileRoute("/s/$token")({
  loader: ({ params }) => getSharedRecord({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.archiveId}${loaderData.title ? ` — ${loaderData.title}` : ""} — The Francis Files`
          : "Link unavailable — The Francis Files",
      },
      {
        name: "description",
        content: loaderData
          ? `Shared archival record ${loaderData.archiveId} from The Francis Files.`
          : "This shared archive link is no longer available.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: SharedRecordPage,
});

function Meta({ label, value, year, estimatedYear }: { label: string; value: string | null; year?: number; estimatedYear?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="text-sm"><FfnText text={value} year={year} estimatedYear={estimatedYear} /></div>
    </div>
  );
}

function Tags({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="field-label mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className="rounded border border-border bg-secondary px-2 py-0.5 text-xs">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function SharedRecordPage() {
  const record = Route.useLoaderData();
  const [index, setIndex] = useState(0);
  const [sideBySide, setSideBySide] = useState(false);

  if (!record) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl">This link is no longer available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The owner of The Francis Files has disabled or replaced this share link.
        </p>
      </main>
    );
  }

  const page = record.pages[index];
  const moneyYear = yearFromDate(record.normalizedDate);
  const estimatedYear = record.dateCertainty !== "certain";
  const dateLine =
    record.dateAsWritten ||
    [record.normalizedDate, record.dateEnd].filter(Boolean).join(" – ") ||
    "Undated";

  const scanViewer = (
    <>
      {page ? (
        <>
          <div className="flex items-center justify-center rounded border border-border bg-muted p-3">
            <img
              src={page.url}
              alt={`${record.archiveId} — ${page.label}`}
              style={{ transform: `rotate(${page.rotation}deg)` }}
              className="max-h-[70vh] w-auto object-contain"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <button
              className="text-primary disabled:opacity-40"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              ← Previous
            </button>
            <span className="text-muted-foreground">
              {page.label} · {index + 1} of {record.pages.length}
            </span>
            <button
              className="text-primary disabled:opacity-40"
              disabled={index >= record.pages.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              Next →
            </button>
          </div>
          {record.pages.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {record.pages.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setIndex(i)}
                  className={`h-16 w-16 overflow-hidden rounded border ${
                    i === index ? "border-primary" : "border-border"
                  }`}
                >
                  <img src={p.thumbUrl} alt={p.label} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No images are available for this record.</p>
      )}
    </>
  );

  const transcriptionPanel = record.transcription ? (
    <section
      id="shared-record-transcription"
      className="lg:sticky lg:top-4 lg:self-start"
      aria-label="Transcription"
    >
      <h2 className="font-display text-lg">Transcription</h2>
      <div className="mt-2 max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded border border-border bg-card p-4 text-sm leading-relaxed lg:max-h-[80vh]">
        {isRichHtml(record.transcription) ? (
          <RichTextView html={record.transcription} year={moneyYear} estimatedYear={estimatedYear} />
        ) : (
          <FfnText text={record.transcription} year={moneyYear} estimatedYear={estimatedYear} />
        )}
      </div>
    </section>
  ) : null;

  const metaAside = (
    <>
      <Meta label="Date" value={dateLine} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="From" value={record.author} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="To" value={record.recipient} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="Location line (written at)" value={record.dateline} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="Mailing origin" value={record.origin} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="Destination" value={record.destination} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="Primary person" value={record.primaryPerson} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="Description" value={record.physicalDescription} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="Summary" value={record.summary} year={moneyYear} estimatedYear={estimatedYear} />
      <Tags label="People" items={record.people} />
      <Tags label="Places" items={record.places} />
      <Tags label="Organizations · ships · units" items={record.organizations} />
      <Tags label="Events" items={record.events} />
      <Tags label="Subjects · tags" items={record.keywords} />
      <Meta label="Notes" value={record.notes} year={moneyYear} estimatedYear={estimatedYear} />
      <Meta label="Note from the archivist" value={record.publicNote} year={moneyYear} estimatedYear={estimatedYear} />
    </>
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="archive-id font-display text-3xl leading-none sm:text-4xl">
            {record.archiveId}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-xs">
              {labelOf(RECORD_TYPES, record.recordType)}
              {record.subtype ? ` · ${record.subtype}` : ""}
            </span>
            {record.title && <span className="font-medium">{record.title}</span>}
            <span className="text-muted-foreground">{dateLine}</span>
          </div>
          {record.transcription && (
            <div className="mt-4">
              <Button
                type="button"
                size="lg"
                variant={sideBySide ? "secondary" : "default"}
                className="w-full text-base font-semibold shadow-md sm:w-auto"
                aria-expanded={sideBySide}
                aria-controls="shared-record-transcription"
                onClick={() => setSideBySide((visible) => !visible)}
              >
                {sideBySide ? (
                  <X className="size-5" />
                ) : (
                  <BookOpenText className="size-5" />
                )}
                {sideBySide
                  ? "Close side-by-side view"
                  : "Read transcription alongside the letter"}
              </Button>
            </div>
          )}
          {record.scope === "file" && record.itemLabel && (
            <p className="mt-2 text-xs text-muted-foreground">
              Single item from this record · {record.itemLabel}
            </p>
          )}
        </div>
      </header>

      {sideBySide && record.transcription ? (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <section>{scanViewer}</section>
            {transcriptionPanel}
          </div>
          <aside className="mt-10 grid gap-5 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-3">
            {metaAside}
          </aside>
        </div>
      ) : (
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[2fr_1fr]">
          <section>{scanViewer}</section>
          <aside className="space-y-5">{metaAside}</aside>
        </div>
      )}

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground sm:px-8">
        The Francis Files · shared privately by link · {record.archiveId}
      </footer>
    </main>
  );
}
