import parse, { domToReact, Element, Text as TextNode, type DOMNode } from "html-react-parser";
import { Link } from "@tanstack/react-router";
import { FfnText } from "@/components/ffn/FfnText";
import { useInlinePhotos } from "@/lib/inline-photos-urls";
import { PHOTO_TOKEN_SRC, photoKey, type InlinePhoto } from "@/lib/inline-photos";
import { sanitizeRichHtml, safeStyle } from "@/lib/rich-text";

function RecordLink({ id }: { id: string }) {
  const cls = "archive-id text-archive-gold underline-offset-2 hover:underline";
  return id.toUpperCase().startsWith("FH") ? (
    <Link to="/letters/$archiveId" params={{ archiveId: id }} className={cls}>
      {id}
    </Link>
  ) : (
    <Link to="/sources/$dsId" params={{ dsId: id }} className={cls}>
      {id}
    </Link>
  );
}

function PhotoFigure({ photo }: { photo: InlinePhoto }) {
  return (
    <figure className="my-4">
      <img
        src={photo.url}
        alt={`${photo.identifier} archive photo`}
        loading="lazy"
        className="w-full rounded border border-border"
      />
      <figcaption className="mt-1 text-xs tracking-widest uppercase">
        <RecordLink id={photo.identifier} />
      </figcaption>
    </figure>
  );
}

/** Photo tokens, record numbers and Francis Files Notes inside one text run. */
function TextRun({ text, photos }: { text: string; photos?: Record<string, InlinePhoto> }) {
  const parts = text.split(new RegExp(`(${PHOTO_TOKEN_SRC}|FH-?\\d{3,}|DS-?\\d{3,})`, "gi"));
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^\[\[photo:/i.test(part)) {
          const photo = photos?.[photoKey(part)];
          return photo ? <PhotoFigure key={i} photo={photo} /> : null;
        }
        if (/^(FH|DS)-?\d{3,}$/i.test(part)) return <RecordLink key={i} id={part} />;
        return <FfnText key={i} text={part} />;
      })}
    </>
  );
}

/** Renders a note written in the rich-text editor. */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  const photos = useInlinePhotos(html);
  const nodes = parse(sanitizeRichHtml(html), {
    replace: (node) => {
      if (node instanceof TextNode) return <TextRun text={node.data} photos={photos} />;
      if (node instanceof Element && node.name === "a") {
        const href = node.attribs["href"];
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {domToReact(node.children as DOMNode[], { replace: (n) => (n instanceof TextNode ? <TextRun text={n.data} photos={photos} /> : undefined) })}
          </a>
        );
      }
      if (node instanceof Element) {
        const style = safeStyle(node.attribs["style"]);
        if (!style) node.attribs = {};
        else node.attribs = { style };
      }
      return undefined;
    },
  });
  return <div className={`rich-text-view ${className ?? ""}`}>{nodes}</div>;
}
