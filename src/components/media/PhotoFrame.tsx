import { Link } from "@tanstack/react-router";
import type { InlinePhoto } from "@/lib/inline-photos";

/** An embedded photo, matted and framed like a print, with its optional title. */
export function PhotoFrame({ photo }: { photo: InlinePhoto }) {
  const id = photo.identifier;
  return (
    <figure className="photo-frame not-prose my-8 mx-auto max-w-[36rem]">
      <div className="photo-frame-mat">
        <img
          src={photo.url}
          alt={photo.caption || (id ? `${id} archive photo` : "Photo")}
          loading="lazy"
          className="block w-full rounded-[2px]"
        />
      </div>
      {(photo.caption || id) && (
        <figcaption className="mt-3 text-center">
          {photo.caption && (
            <span className="block font-serif text-base italic leading-snug text-foreground">
              {photo.caption}
            </span>
          )}
          {id && (
            <span className="mt-1.5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]">
              <span aria-hidden className="h-px w-6 bg-archive-gold/60" />
              {id.startsWith("FH") ? (
                <Link to="/letters/$archiveId" params={{ archiveId: id }} className="archive-id text-archive-gold hover:underline">
                  {id}
                </Link>
              ) : (
                <Link to="/sources/$dsId" params={{ dsId: id }} className="archive-id text-archive-gold hover:underline">
                  {id}
                </Link>
              )}
              <span aria-hidden className="h-px w-6 bg-archive-gold/60" />
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
