/**
 * Select any text in the archive, right-click, and turn it into a Francis File
 * Note. Administrators only; everyone else keeps their normal browser menu.
 * On touch devices a small floating button appears instead of a menu.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BookOpen, Plus, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchAliasIndex, normAlias, type FfnNote } from "@/lib/ffn";
import { QuickNoteDialog, type QuickNoteSeed } from "./QuickNoteDialog";

const MAX_TERM = 80;
const MAX_CONTEXT = 400;

/** The sentence around the selection, taken from the surrounding element. */
function sentenceAround(sel: Selection, term: string): string {
  const node = sel.anchorNode;
  const host = (node?.nodeType === 1 ? (node as Element) : node?.parentElement) ?? null;
  const full = (host?.textContent ?? term).replace(/\s+/g, " ").trim();
  const i = full.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return full.slice(0, MAX_CONTEXT);
  let start = full.lastIndexOf(".", Math.max(0, i - 1));
  start = start < 0 ? Math.max(0, i - 160) : start + 1;
  let end = full.indexOf(".", i + term.length);
  end = end < 0 ? Math.min(full.length, i + term.length + 200) : end + 1;
  return full.slice(start, end).trim().slice(0, MAX_CONTEXT);
}

function readSelection(): { term: string; context: string } | null {
  const sel = window.getSelection();
  const raw = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
  if (!sel || !raw || raw.length > MAX_TERM) return null;
  return { term: raw, context: sentenceAround(sel, raw) };
}

export function FfnSelectionMenu() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    term: string;
    context: string;
    existing: FfnNote | null;
  } | null>(null);
  const [touchAnchor, setTouchAnchor] = useState<{ x: number; y: number } | null>(null);
  const [seed, setSeed] = useState<QuickNoteSeed | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setMenu(null);
    setTouchAnchor(null);
  }, []);

  useEffect(close, [pathname, close]);

  /** Existing published note whose term/alias matches the selection. */
  const matchNote = useCallback(async (term: string): Promise<FfnNote | null> => {
    try {
      const { entries, notes } = await fetchAliasIndex();
      const key = normAlias(term);
      const hit = entries.find((e) => normAlias(e.alias) === key);
      return hit ? (notes[hit.noteId] ?? null) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const onContextMenu = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const picked = readSelection();
      if (!picked) return;
      e.preventDefault();
      setTouchAnchor(null);
      setMenu({ x: e.clientX, y: e.clientY, ...picked, existing: null });
      const existing = await matchNote(picked.term);
      setMenu((m) => (m && m.term === picked.term ? { ...m, existing } : m));
    };

    const onSelectionChange = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      const picked = readSelection();
      if (!picked) {
        setTouchAnchor(null);
        return;
      }
      const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return;
      setTouchAnchor({ x: rect.left, y: rect.bottom + 8 });
    };

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", close, true);
    };
  }, [isAdmin, close, matchNote]);

  if (!isAdmin) return null;

  const openQuickNote = (term: string, context: string) => {
    setSeed({ term, context });
    close();
  };

  const item =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  return (
    <>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[80] w-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
            style={{
              left: Math.min(menu.x, window.innerWidth - 272),
              top: Math.min(menu.y, window.innerHeight - 160),
            }}
          >
            <p className="truncate border-b border-border px-3 py-2 text-[11px] font-bold tracking-[0.16em] text-archive-gold uppercase">
              “{menu.term}”
            </p>
            {menu.existing && (
              <button
                className={item}
                onClick={() => {
                  const slug = menu.existing!.slug;
                  close();
                  navigate({ to: "/notes/$slug", params: { slug } });
                }}
              >
                <BookOpen className="size-4" /> Open Francis File Note
              </button>
            )}
            <button className={item} onClick={() => openQuickNote(menu.term, menu.context)}>
              <Plus className="size-4" /> Create Francis File Note
            </button>
            <button
              className={item}
              onClick={() => {
                const term = menu.term;
                close();
                navigate({ to: "/search", search: { q: term } as never });
              }}
            >
              <Search className="size-4" /> Search the archive
            </button>
          </div>,
          document.body,
        )}

      {touchAnchor &&
        createPortal(
          <button
            className="fixed z-[80] flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg"
            style={{
              left: Math.min(touchAnchor.x, window.innerWidth - 180),
              top: Math.min(touchAnchor.y, window.innerHeight - 56),
            }}
            onClick={() => {
              const picked = readSelection();
              if (picked) openQuickNote(picked.term, picked.context);
            }}
          >
            <Plus className="size-3.5" /> Francis File Note
          </button>,
          document.body,
        )}

      <QuickNoteDialog seed={seed} onOpenChange={(open) => !open && setSeed(null)} />
    </>
  );
}
