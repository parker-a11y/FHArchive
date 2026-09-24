import parse, { domToReact, type DOMNode } from "html-react-parser";

/** Duck-typed node checks: instanceof fails across bundled parser copies. */
function isText(node: unknown): node is { type: "text"; data: string } {
  return !!node && (node as { type?: string }).type === "text";
}
function isElement(node: unknown): node is { type: string; name: string; attribs: Record<string, string>; children: unknown[] } {
  const t = (node as { type?: string } | null)?.type;
  return !!node && (t === "tag" || t === "script" || t === "style");
}
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
function TextRun({ text, photos, year, estimatedYear }: { text: string; photos?: Record<string, InlinePhoto>; year?: number; estimatedYear?: boolean }) {
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
        return <FfnText key={i} text={part} year={year} estimatedYear={estimatedYear} />;
      })}
    </>
  );
}

/** Renders a note written in the rich-text editor. */
export function RichTextView({ html, className, year, estimatedYear }: { html: string; className?: string; year?: number; estimatedYear?: boolean }) {
  const photos = useInlinePhotos(html);
  const nodes = parse(sanitizeRichHtml(html), {
    replace: (node) => {
      if (isText(node)) return <TextRun text={node.data} photos={photos} year={year} estimatedYear={estimatedYear} />;
      if (isElement(node) && node.name === "a") {
        const href = node.attribs["href"];
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {domToReact(node.children as DOMNode[], { replace: (n) => (isText(n) ? <TextRun text={n.data} photos={photos} year={year} estimatedYear={estimatedYear} /> : undefined) })}
          </a>
        );
      }
      if (isElement(node)) {
        const style = safeStyle(node.attribs["style"]);
        if (!style) node.attribs = {};
        else node.attribs = { style };
      }
      return undefined;
    },
  });
  return <div className={`rich-text-view ${className ?? ""}`}>{nodes}</div>;
}
