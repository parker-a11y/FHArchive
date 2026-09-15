import { Link } from "@tanstack/react-router";
import { FfnText } from "@/components/ffn/FfnText";
import { useInlinePhotos } from "@/lib/inline-photos-urls";
import { isolatePhotoTokens, isPhotoBlock, photoOfBlock } from "@/lib/inline-photos";


/** Turns FH / DS record numbers into links into the archive. */
export function RecapInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|FH-?\d{3,}|DS-?\d{3,})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part))
          return (
            <strong key={i}>
              <RecapInline text={part.slice(2, -2)} />
            </strong>
          );
        if (/^\*[^*]+\*$/.test(part))
          return (
            <em key={i}>
              <RecapInline text={part.slice(1, -1)} />
            </em>
          );
        if (/^FH-?\d{3,}$/.test(part))
          return (
            <Link
              key={i}
              to="/letters/$archiveId"
              params={{ archiveId: part }}
              className="archive-id text-archive-gold underline-offset-2 hover:underline"
            >
              {part}
            </Link>
          );
        if (/^DS-?\d{3,}$/.test(part))
          return (
            <Link
              key={i}
              to="/sources/$dsId"
              params={{ dsId: part }}
              className="archive-id text-archive-gold underline-offset-2 hover:underline"
            >
              {part}
            </Link>
          );
        return (
          <span key={i}>
            <FfnText text={part} />
          </span>
        );
      })}
    </>
  );
}

/** Narrative markdown: headings, paragraphs, bullets and pull quotes. */
export function RecapBody({ text }: { text: string }) {
  const photos = useInlinePhotos(text);
  const blocks = isolatePhotoTokens(text).trim().split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[15px] leading-relaxed">
      {blocks.map((block, i) => {
        if (isPhotoBlock(block)) {
          const photo = photoOfBlock(block, photos);
          if (!photo) return null;
          return (
            <figure key={i} className="my-4">
              <img
                src={photo.url}
                alt={`${photo.identifier} archive photo`}
                className="w-full rounded border border-border"
                loading="lazy"
              />
              <figcaption className="mt-1 text-xs tracking-widest uppercase">
                {photo.identifier.startsWith("FH") ? (
                  <Link
                    to="/letters/$archiveId"
                    params={{ archiveId: photo.identifier }}
                    className="archive-id text-archive-gold underline-offset-2 hover:underline"
                  >
                    {photo.identifier}
                  </Link>
                ) : (
                  <Link
                    to="/sources/$dsId"
                    params={{ dsId: photo.identifier }}
                    className="archive-id text-archive-gold underline-offset-2 hover:underline"
                  >
                    {photo.identifier}
                  </Link>
                )}
              </figcaption>

            </figure>
          );
        }

        const lines = block.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;


        if (/^#{1,4}\s/.test(lines[0]!) && lines.length === 1)
          return (
            <h2
              key={i}
              className="font-display mt-8 border-b border-border pb-1 text-lg font-semibold tracking-tight first:mt-0"
            >
              {lines[0]!.replace(/^#{1,4}\s/, "")}
            </h2>
          );

        if (lines.every((l) => /^\s*>/.test(l)))
          return (
            <blockquote
              key={i}
              className="border-l-4 border-archive-gold/60 bg-muted/40 py-3 pr-3 pl-4 text-[15px] italic"
            >
              <RecapInline text={lines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ")} />
            </blockquote>
          );

        if (lines.every((l) => /^\s*[-*]\s+/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-2 pl-5">
              {lines.map((l, j) => (
                <li key={j}>
                  <RecapInline text={l.replace(/^\s*[-*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );

        return (
          <p key={i}>
            <RecapInline text={lines.join(" ")} />
          </p>
        );
      })}
    </div>
  );
}
