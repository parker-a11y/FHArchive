import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useFfnImageUrls } from "@/lib/ffn-images";
import { ArrowLeft } from "lucide-react";
import {
  categoryLabel,
  fetchImages,
  fetchNote,
  fetchOccurrences,
  fetchRelatedNotes,
  noteTitle,
} from "@/lib/ffn";

export const Route = createFileRoute("/notes/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Francis File Note` },
      {
        name: "description",
        content:
          "A Francis File Note: plain-language background on a term, person, place or ship that appears in the Francis Harrington archive.",
      },
      { property: "og:title", content: "Francis File Note" },
      {
        property: "og:description",
        content: "Background on a term from the Francis Harrington archive.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotePage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display border-b border-border pb-1 text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

const paragraphs = (text: string) =>
  text
    .trim()
    .split(/\n{2,}/)
    .map((p, i) => <p key={i}>{p}</p>);

function NotePage() {
  const { slug } = Route.useParams();
  const { data: note, isLoading } = useQuery({
    queryKey: ["ffn-note", slug],
    queryFn: () => fetchNote(slug),
  });
  const { data: images = [] } = useQuery({
    queryKey: ["ffn-images", note?.id],
    queryFn: () => fetchImages(note!.id),
    enabled: !!note?.id,
  });
  const { data: related = [] } = useQuery({
    queryKey: ["ffn-related", note?.id],
    queryFn: () => fetchRelatedNotes(note!.id),
    enabled: !!note?.id,
  });
  const { data: occurrences = [] } = useQuery({
    queryKey: ["ffn-occurrences", note?.id],
    queryFn: () => fetchOccurrences(note!.id),
    enabled: !!note?.id,
  });

  const imageUrl = useFfnImageUrls(images);

  if (isLoading) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!note)
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-sm">No Francis File Note found for “{slug}”.</p>
        <Link to="/notes" className="text-sm text-primary underline">
          All Francis File Notes
        </Link>
      </main>
    );

  const primary = images.find((i) => i.is_primary) ?? images[0];
  const gallery = images.filter((i) => i.id !== primary?.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        to="/notes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Francis File Notes
      </Link>

      <header className="mt-4 border-b border-border pb-5">
        <p className="text-[11px] font-bold tracking-[0.2em] text-archive-gold uppercase">
          Francis File Note · {categoryLabel(note.category)}
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
          {noteTitle(note)}
        </h1>
        {note.expanded_name && (
          <p className="mt-1 text-lg text-muted-foreground">{note.expanded_name}</p>
        )}
        {note.short_definition && <p className="mt-3 text-[15px]">{note.short_definition}</p>}
      </header>

      {primary && imageUrl(primary) && (
        <figure className="mt-6 space-y-1">
          <img
            src={imageUrl(primary)}
            alt={primary.caption ?? noteTitle(note)}
            className="w-full rounded border border-border"
          />
          {(primary.caption || primary.credit || primary.rights_note) && (
            <figcaption className="text-xs text-muted-foreground">
              {[primary.caption, primary.credit, primary.rights_note].filter(Boolean).join(" · ")}
            </figcaption>
          )}
        </figure>
      )}

      {note.background && <Section title="Historical background">{paragraphs(note.background)}</Section>}

      {note.archive_context && (
        <Section title="Why this matters in the Francis Files">
          {paragraphs(note.archive_context)}
        </Section>
      )}

      {related.length > 0 && (
        <Section title="Related Francis File Notes">
          <div className="flex flex-wrap gap-1.5">
            {related.map((r) => (
              <Link
                key={r.id}
                to="/notes/$slug"
                params={{ slug: r.slug }}
                className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/70"
              >
                {noteTitle(r)}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {gallery.length > 0 && (
        <Section title="Image gallery">
          <div className="grid gap-4 sm:grid-cols-2">
            {gallery.map(
              (img) =>
                imageUrl(img) && (
                  <figure key={img.id} className="space-y-1">
                    <img
                      src={imageUrl(img)}
                      alt={img.caption ?? noteTitle(note)}
                      loading="lazy"
                      className="w-full rounded border border-border"
                    />
                    {(img.caption || img.credit) && (
                      <figcaption className="text-xs text-muted-foreground">
                        {[img.caption, img.credit].filter(Boolean).join(" · ")}
                      </figcaption>
                    )}
                  </figure>
                ),
            )}
          </div>
        </Section>
      )}

      {occurrences.length > 0 && (
        <Section title={`Appears in the archive (${occurrences.length})`}>
          <ul className="divide-y rounded-lg border">
            {occurrences.map((o) => (
              <li key={o.id} className="p-3">
                <Link
                  to="/letters/$archiveId"
                  params={{ archiveId: (o.ref_label ?? "").split(" — ")[0]! }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {o.ref_label}
                </Link>
                {o.excerpt && (
                  <p className="mt-1 text-sm text-muted-foreground italic">“{o.excerpt}”</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {note.sources && <Section title="Sources">{paragraphs(note.sources)}</Section>}
    </main>
  );
}
