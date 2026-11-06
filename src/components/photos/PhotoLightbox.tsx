import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Info, Maximize, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { viewPath, originalName, fetchPhotoOriginal, type Photo } from "@/lib/photos";
import { deliverFile } from "@/lib/download";
import { signPhotoPath, useSignedPath } from "@/components/photos/SignedImg";

type Props = {
  photos: Photo[];
  index: number;
  categoryNames: (p: Photo) => string[];
  boxLabel?: (p: Photo) => string | null;
  canDownloadOriginal: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
};

/** Full-screen, dark-stage photo viewer. Previous/Next walk the list it was opened from. */
export function PhotoLightbox({ photos, index, categoryNames, boxLabel, canDownloadOriginal, onIndex, onClose }: Props) {
  const photo = photos[index];
  const [side, setSide] = useState<"front" | "back">("front");
  const [info, setInfo] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { setSide("front"); setZoom(1); setPan({ x: 0, y: 0 }); }, [index]);
  useEffect(() => { setInfo(typeof window !== "undefined" && window.innerWidth >= 900); }, []);

  const go = useCallback((d: number) => {
    if (!photos.length) return;
    onIndex((index + d + photos.length) % photos.length);
  }, [index, onIndex, photos.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (document.fullscreenElement) return; onClose(); }
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(5, z + 0.5));
      else if (e.key === "-") setZoom((z) => Math.max(1, z - 0.5));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [go, onClose]);

  // Warm the neighbours so Next feels instant.
  useEffect(() => {
    for (const d of [1, -1]) {
      const n = photos[(index + d + photos.length) % photos.length];
      const p = n && viewPath(n.front_path, n.front_thumb_path, n.front_view_path);
      if (p) void signPhotoPath(p).then((u) => { if (u) { const i = new Image(); i.src = u; } });
    }
  }, [index, photos]);

  const path = !photo ? null : side === "front"
    ? viewPath(photo.front_path, photo.front_thumb_path, photo.front_view_path)
    : viewPath(photo.back_path, photo.back_thumb_path, photo.back_view_path);
  const url = useSignedPath(path);
  if (!photo) return null;

  const title = photo.caption || "Untitled photograph";
  const cats = categoryNames(photo);
  const box = boxLabel?.(photo) ?? null;
  const rows: [string, string | null | undefined][] = [
    ["People", photo.people], ["Date", photo.date_text], ["Location", photo.location],
    ["Categories", cats.join(", ") || null], ["Description", photo.notes],
    ["Information source", photo.info_source], ["Former FH number", photo.legacy_archive_id],
    ["Storage box", box],
  ];

  const download = async () => {
    try {
      if (canDownloadOriginal) {
        const src = side === "front" ? photo.front_path : photo.back_path;
        if (!src) return;
        const f = await fetchPhotoOriginal(src);
        deliverFile(f.blob, f.name);
        return;
      }
      if (!url) return;
      const res = await fetch(url);
      const blob = await res.blob();
      const base = (photo.ph_id ?? originalName(photo.front_path).replace(/\.[a-z0-9]+$/i, "")) + (side === "back" ? "-back" : "");
      deliverFile(blob, `${base}.jpg`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const fullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label={title}
      className="fixed inset-0 z-50 flex bg-gallery-stage text-gallery-stage-foreground animate-in fade-in duration-200">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-5">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-widest opacity-70">{photo.ph_id ?? "Unnumbered"} · {index + 1} of {photos.length}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {photo.back_path && (
              <div className="mr-1 flex rounded-full border border-gallery-stage-foreground/25 p-0.5 text-xs">
                {(["front", "back"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSide(s)}
                    className={`rounded-full px-3 py-1 capitalize transition ${side === s ? "bg-gallery-stage-foreground text-gallery-stage" : "opacity-70 hover:opacity-100"}`}>{s}</button>
                ))}
              </div>
            )}
            <IconBtn label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}><Minus /></IconBtn>
            <IconBtn label="Zoom in" onClick={() => setZoom((z) => Math.min(5, z + 0.5))}><Plus /></IconBtn>
            <IconBtn label="Full screen" onClick={fullscreen}><Maximize /></IconBtn>
            <IconBtn label={canDownloadOriginal ? "Download original" : "Download viewing copy"} onClick={download}><Download /></IconBtn>
            <IconBtn label="Photo information" onClick={() => setInfo((v) => !v)} active={info}><Info /></IconBtn>
            <IconBtn label="Close" onClick={onClose}><X /></IconBtn>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden select-none"
          onWheel={(e) => { if (e.ctrlKey || zoom > 1) { e.preventDefault(); setZoom((z) => Math.min(5, Math.max(1, z - e.deltaY * 0.002))); } }}
          onDoubleClick={() => { setZoom((z) => (z > 1 ? 1 : 2.5)); setPan({ x: 0, y: 0 }); }}
          onPointerDown={(e) => { if (zoom > 1) { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; (e.target as Element).setPointerCapture?.(e.pointerId); } }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }); }}
          onPointerUp={() => { drag.current = null; }}
          onTouchStart={(e) => { if (zoom === 1 && e.touches.length === 1) touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={(e) => {
            const t = touch.current; touch.current = null;
            if (!t || zoom > 1) return;
            const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          }}>
          {url ? (
            <img key={url} src={url} alt={title} draggable={false}
              className="max-h-full max-w-full object-contain animate-in fade-in duration-300"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? "grab" : "zoom-in", transition: drag.current ? "none" : "transform 150ms ease-out" }} />
          ) : <p className="text-sm opacity-60">{path ? "Loading…" : "No viewing copy for this side yet"}</p>}
          {photos.length > 1 && <>
            <NavBtn side="left" onClick={() => go(-1)} />
            <NavBtn side="right" onClick={() => go(1)} />
          </>}
        </div>
        <div className="px-4 pb-3 pt-1 text-center">
          <p className="font-display text-xl leading-tight sm:text-2xl">{title}</p>
        </div>
      </div>
      {info && (
        <aside className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto border-t border-gallery-stage-foreground/15 bg-gallery-stage/95 p-5 backdrop-blur sm:static sm:max-h-none sm:w-80 sm:border-l sm:border-t-0">
          <p className="font-mono text-xs tracking-widest opacity-60">{photo.ph_id ?? "Unnumbered"}</p>
          <h2 className="mt-1 font-display text-2xl leading-snug">{title}</h2>
          {photo.inscription && (
            <figure className="mt-4 border-l-2 border-gallery-stage-foreground/40 pl-3">
              <figcaption className="text-[11px] uppercase tracking-widest opacity-60">Original inscription</figcaption>
              <blockquote className="mt-1 whitespace-pre-wrap font-display text-lg italic">“{photo.inscription}”</blockquote>
            </figure>
          )}
          {side === "back" && photo.back_transcription && (
            <figure className="mt-4 border-l-2 border-gallery-stage-foreground/40 pl-3">
              <figcaption className="text-[11px] uppercase tracking-widest opacity-60">Writing on the back</figcaption>
              <blockquote className="mt-1 whitespace-pre-wrap font-display text-lg italic">{photo.back_transcription}</blockquote>
            </figure>
          )}
          <dl className="mt-4 space-y-3 text-sm">
            {rows.filter(([, v]) => v && v.trim()).map(([k, v]) => (
              <div key={k}><dt className="text-[11px] uppercase tracking-widest opacity-60">{k}</dt><dd className="mt-0.5 whitespace-pre-wrap">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-6 text-xs opacity-50">← → to browse · double-click to zoom · Esc to close</p>
        </aside>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <Button type="button" size="icon" variant="ghost" aria-label={label} title={label} onClick={onClick}
      className={`h-9 w-9 rounded-full text-gallery-stage-foreground hover:bg-gallery-stage-foreground/10 hover:text-gallery-stage-foreground [&_svg]:size-4 ${active ? "bg-gallery-stage-foreground/15" : ""}`}>
      {children}
    </Button>
  );
}

function NavBtn({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button type="button" aria-label={side === "left" ? "Previous photograph" : "Next photograph"} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`absolute top-1/2 hidden -translate-y-1/2 rounded-full p-3 opacity-60 transition hover:bg-gallery-stage-foreground/10 hover:opacity-100 sm:block ${side === "left" ? "left-2" : "right-2"}`}>
      <Icon className="size-7" />
    </button>
  );
}
