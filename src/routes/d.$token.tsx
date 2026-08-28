import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getSharedSource } from "@/lib/source-shares.functions";
import { dsTypeLabel } from "@/lib/sources";

export const Route = createFileRoute("/d/$token")({
  loader: ({ params }) => getSharedSource({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.dsId} — ${loaderData.title} — Harrington Archive`
          : "Link unavailable — Harrington Archive",
      },
      {
        name: "description",
        content: loaderData
          ? `Shared digital source ${loaderData.dsId} from the Harrington family archive.`
          : "This shared archive link is no longer available.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: SharedSourcePage,
});

function Meta({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="text-sm break-words">{value}</div>
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

function FileView({
  file,
}: {
  file: { label: string; fileType: string; mimeType: string | null; url: string };
}) {
  if (file.fileType === "image")
    return (
      <div className="flex items-center justify-center rounded border border-border bg-muted p-3">
        <img src={file.url} alt={file.label} className="max-h-[70vh] w-auto object-contain" />
      </div>
    );
  if (file.fileType === "audio")
    return <audio controls src={file.url} className="w-full" />;
  if (file.fileType === "video")
    return <video controls src={file.url} className="max-h-[70vh] w-full rounded border border-border" />;
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="inline-block rounded border border-border px-3 py-2 text-sm text-primary"
    >
      Open {file.label}
    </a>
  );
}

function SharedSourcePage() {
  const source = Route.useLoaderData();
  const [index, setIndex] = useState(0);

  if (!source) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl">This link is no longer available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The owner of the Harrington family archive has disabled or replaced this share link.
        </p>
      </main>
    );
  }

  const file = source.files[index];
  const dateLine =
    source.originalDate || source.historicalDateRange || source.normalizedDate || "Undated";

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="archive-id font-display text-3xl leading-none sm:text-4xl">
            {source.dsId}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-xs">
              Digital source · {dsTypeLabel(source.sourceType)}
            </span>
            <span className="font-medium">{source.title}</span>
            <span className="text-muted-foreground">{dateLine}</span>
          </div>
          {source.scope === "file" && source.itemLabel && (
            <p className="mt-2 text-xs text-muted-foreground">
              Single item from this source · {source.itemLabel}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[2fr_1fr]">
        <section>
          {file ? (
            <>
              <FileView file={file} />
              <div className="mt-2 flex items-center justify-between text-sm">
                <button
                  className="text-primary disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  ← Previous
                </button>
                <span className="text-muted-foreground">
                  {file.label} · {index + 1} of {source.files.length}
                </span>
                <button
                  className="text-primary disabled:opacity-40"
                  disabled={index >= source.files.length - 1}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  Next →
                </button>
              </div>
              {source.files.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {source.files.map((f, i) => (
                    <button
                      key={f.id}
                      onClick={() => setIndex(i)}
                      className={`rounded border px-2 py-1 text-xs ${
                        i === index ? "border-primary text-primary" : "border-border"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No preservation copies are available for this source.
            </p>
          )}

          {source.description && (
            <section className="mt-8">
              <h2 className="font-display text-lg">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {source.description}
              </p>
            </section>
          )}

          {source.transcript && (
            <section className="mt-8">
              <h2 className="font-display text-lg">Transcript</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{source.transcript}</p>
            </section>
          )}
        </section>

        <aside className="space-y-5">
          <Meta label="Date" value={dateLine} />
          <Meta label="Creator" value={source.creator} />
          <Meta label="Institution / repository" value={source.institution} />
          <Meta label="Date accessed" value={source.dateAccessed} />
          {source.url && (
            <div>
              <div className="field-label">Original source</div>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer nofollow"
                className="break-all text-sm text-primary underline"
              >
                {source.url}
              </a>
            </div>
          )}
          <Tags label="People" items={source.people} />
          <Tags label="Places" items={source.places} />
          <Tags label="Organizations · ships · units" items={source.organizations} />
          <Tags label="Events" items={source.events} />
          <Tags label="Subjects · tags" items={source.keywords} />
          <Meta label="Citation" value={source.citation} />
          <Meta label="Rights / usage" value={source.rightsNotes} />
          <Meta label="Notes" value={source.notes} />
          <Meta label="Note from the archivist" value={source.publicNote} />
        </aside>
      </div>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground sm:px-8">
        Harrington Family Archive · shared privately by link · {source.dsId}
      </footer>
    </main>
  );
}
