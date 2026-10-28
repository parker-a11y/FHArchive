import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  PHOTO_TOKEN_SRC,
  IMAGE_URL_TOKEN_SRC,
  resolvePhotoToken,
  type InlinePhoto,
} from "@/lib/inline-photos";
import { useInlinePhotos } from "@/lib/inline-photos-urls";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  plainTextToRichHtml,
  quotedPasteToRichHtml,
  isQuotedParagraph,
  sanitizeRichHtml,
} from "@/lib/rich-text";

/**
 * Shows a live preview of each embedded photo token directly under the token's
 * paragraph, so the composer sees the image a reader will see. The token text
 * itself stays in the document untouched.
 */
const inlinePhotoPreviewKey = new PluginKey("inlinePhotoPreview");
function inlinePhotoPreview(getPhotos: () => Record<string, InlinePhoto>) {
  return Extension.create({
    name: "inlinePhotoPreview",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: inlinePhotoPreviewKey,
          props: {
            decorations(state) {
              const photos = getPhotos();
              const re = new RegExp(`${PHOTO_TOKEN_SRC}|${IMAGE_URL_TOKEN_SRC}`, "gi");
              const decos: Decoration[] = [];
              state.doc.descendants((node, pos) => {
                if (!node.isTextblock) return;
                const text = node.textContent;
                re.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = re.exec(text))) {
                  const photo = resolvePhotoToken(m[0], photos);
                  if (!photo?.url) continue;
                  const end = pos + node.nodeSize - 1;
                  decos.push(
                    Decoration.widget(
                      end,
                      () => {
                        const wrap = document.createElement("div");
                        wrap.style.cssText =
                          "margin:0.35rem 0 0.75rem;pointer-events:none;";
                        const img = document.createElement("img");
                        img.src = photo.url;
                        img.alt = photo.caption || photo.identifier || "Embedded image";
                        img.style.cssText =
                          "max-height:12rem;max-width:100%;border-radius:0.375rem;border:1px solid hsl(var(--border));object-fit:contain;display:block;";
                        wrap.appendChild(img);
                        const label = photo.caption || photo.identifier;
                        if (label) {
                          const cap = document.createElement("div");
                          cap.textContent = label;
                          cap.style.cssText =
                            "font-size:0.7rem;color:hsl(var(--muted-foreground));font-style:italic;margin-top:0.15rem;";
                          wrap.appendChild(cap);
                        }
                        return wrap;
                      },
                      { side: 1, key: `photo-${m[0]}` },
                    ),
                  );
                }
              });
              return DecorationSet.create(state.doc, decos);
            },
          },
        }),
      ];
    },
  });
}

/** Radix Select items cannot use an empty value, so "Default" uses a sentinel. */
const DEFAULT_FONT = "__default__";

const FONTS: { label: string; value: string }[] = [
  { label: "Default", value: DEFAULT_FONT },
  { label: "Serif (Georgia)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Sans (Helvetica)", value: "Helvetica, Arial, sans-serif" },
  { label: "Typewriter", value: "'Courier New', Courier, monospace" },
];

/** Plain notes written before the editor existed still open cleanly. */
export function toEditorHtml(value: string) {
  return plainTextToRichHtml(value);
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={label}
      title={label}
      aria-pressed={Boolean(active)}
      className={cn("size-8 p-0", active && "bg-secondary text-foreground")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * Quote button behaviour. A plain blockquote toggle always quotes (or unquotes)
 * the entire paragraph, so quoting one line of a long paragraph quoted all of
 * it. When the selection covers only part of a single paragraph, split the
 * paragraph at the selection boundaries first so just the selected lines
 * become the quotation.
 */
function toggleQuote(editor: Editor) {
  const { from, to, empty } = editor.state.selection;
  const $from = editor.state.doc.resolve(from);
  const $to = editor.state.doc.resolve(to);
  const canSplit =
    !empty &&
    $from.sameParent($to) &&
    $from.parent.type.name === "paragraph" &&
    !(from <= $from.start() && to >= $from.end());
  if (!canSplit) {
    editor.chain().focus().toggleBlockquote().run();
    return;
  }
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      // Split the later boundary first so earlier positions stay valid.
      if (to < $from.end()) tr.split(to, $to.depth);
      if (from > $from.start()) tr.split(from, $from.depth);
      return true;
    })
    .setTextSelection(from + 1)
    .toggleBlockquote()
    .run();
}

function Toolbar({
  editor,
  extras,
  mode = "full",
}: {
  editor: Editor;
  extras?: React.ReactNode;
  mode?: "full" | "transcription" | "none";
}) {
  if (mode === "none") return null;
  const font = (editor.getAttributes("textStyle")["fontFamily"] as string) ?? "";
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1 py-1">
      <ToolButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolButton>
      <ToolButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </ToolButton>

      <span className="mx-1 h-5 w-px bg-border" />

      {mode === "full" ? <ToolButton
        label="Subheading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolButton> : null}
      {mode === "full" ? <ToolButton
        label="Small heading"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </ToolButton> : null}
      {mode === "full" ? <ToolButton
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolButton> : null}
      {mode === "full" ? <ToolButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolButton> : null}
      {mode === "full" ? <ToolButton
        label="Quotation"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </ToolButton> : null}

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolButton
        label="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="size-4" />
      </ToolButton>
      <ToolButton
        label="Align centre"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="size-4" />
      </ToolButton>
      <ToolButton
        label="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="size-4" />
      </ToolButton>
      <ToolButton
        label="Justify"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify className="size-4" />
      </ToolButton>

      {mode === "full" ? <span className="mx-1 h-5 w-px bg-border" /> : null}

      {mode === "full" ? <ToolButton
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt("Link address (https://…)");
          if (!url) return;
          editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        <Link2 className="size-4" />
      </ToolButton> : null}

      {mode === "full" ? <Select
        value={font || DEFAULT_FONT}
        onValueChange={(v) =>
          v && v !== DEFAULT_FONT
            ? editor.chain().focus().setFontFamily(v).run()
            : editor.chain().focus().unsetFontFamily().run()
        }
      >
        <SelectTrigger className="ml-1 h-8 w-36 text-xs">
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
          {FONTS.map((f) => (
            <SelectItem key={f.label} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select> : null}

      {extras ? <div className="ml-auto flex items-center gap-1">{extras}</div> : null}
    </div>
  );
}

/**
 * A small WYSIWYG editor used for the email note and the recap body. The value
 * is allow-listed HTML; callers store it in the same text column as before.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "10rem",
  toolbarExtras,
  onEditorReady,
  toolbarMode = "full",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  toolbarExtras?: React.ReactNode;
  onEditorReady?: (editor: Editor | null) => void;
  toolbarMode?: "full" | "transcription" | "none";
}) {
  const photos = useInlinePhotos(value);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TextStyle,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      inlinePhotoPreview(() => photosRef.current),
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        class: "rich-text-editor focus:outline-none",
        style: `min-height:${minHeight}`,
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
      handlePaste(view, event) {
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (/<(strong|b|em|i|u|s|a|ul|ol|li|h[1-6]|blockquote)\b/i.test(html)) {
          // Rich paste: keep inline formatting, but wrap fully quoted paragraphs as quotations.
          const container = document.createElement("div");
          container.innerHTML = sanitizeRichHtml(
            html.replace(/<div\b/gi, "<p").replace(/<\/div>/gi, "</p>"),
          );
          let changed = false;
          for (const el of Array.from(container.children)) {
            if (el.tagName === "P" && isQuotedParagraph(el.textContent ?? "")) {
              const bq = document.createElement("blockquote");
              el.replaceWith(bq);
              bq.appendChild(el);
              changed = true;
            }
          }
          if (!changed) return false;
          event.preventDefault();
          const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(container);
          view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
          return true;
        }
        const pasted = event.clipboardData?.getData("text/plain") ?? "";
        const formatted = quotedPasteToRichHtml(pasted);
        if (!formatted) return false;
        event.preventDefault();
        const container = document.createElement("div");
        container.innerHTML = formatted;
        const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(container);
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChange(html === "<p></p>" ? "" : sanitizeRichHtml(html));
    },
  });

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Signed photo URLs arrive asynchronously; nudge the editor to re-decorate.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(inlinePhotoPreviewKey, "refresh"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, editor]);

  // Reflect programmatic changes (e.g. a prefilled note) without fighting typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = toEditorHtml(value);
    const current = editor.getHTML();
    if (incoming !== current && sanitizeRichHtml(current) !== value)
      editor.commands.setContent(incoming, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor)
    return (
      <div
        className={cn("min-w-0 w-full rounded-md border border-input bg-background", className)}
        style={{ minHeight }}
      />
    );

  return (
    <div className={cn("min-w-0 w-full overflow-hidden rounded-md border border-input bg-background", className)}>
      <Toolbar editor={editor} extras={toolbarExtras} mode={toolbarMode} />
      <EditorContent editor={editor} className="min-w-0 max-w-full px-3 py-2 text-sm" />
    </div>
  );
}

/** Inserts an archive photo token as its own paragraph at the cursor. */
export function insertTokenParagraph(editor: Editor | null, token: string) {
  if (!editor) return false;
  editor.chain().focus().insertContent(`<p>${token}</p>`).run();
  return true;
}
