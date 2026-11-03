import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BOOK_FONT_FILES, createBookFonts, type BookFonts } from "@/lib/book/fonts";
import { buildPlan, LAYOUT } from "@/lib/book/layout";
import { PRINT_DPI_GOOD, PRINT_DPI_MIN, type BookMeta, type BookPlan, type BookRecordSource, type FontKey, type PlannedPage } from "@/lib/book/types";

let fontsPromise: Promise<Record<FontKey, Uint8Array>> | null = null;
function loadFontBytes() {
  fontsPromise ??= (async () => {
    const out = {} as Record<FontKey, Uint8Array>;
    for (const [k, f] of Object.entries(BOOK_FONT_FILES) as Array<[FontKey, string]>) {
      const res = await fetch(`/fonts/book/${f}`);
      if (!res.ok) throw new Error("Book typeface could not be loaded");
      out[k] = new Uint8Array(await res.arrayBuffer());
    }
    return out;
  })();
  return fontsPromise;
}

const FONT_CSS: Record<FontKey, { fontStyle: string; fontWeight: number }> = {
  regular: { fontStyle: "normal", fontWeight: 400 },
  italic: { fontStyle: "italic", fontWeight: 400 },
  bold: { fontStyle: "normal", fontWeight: 600 },
  boldItalic: { fontStyle: "italic", fontWeight: 600 },
};

export function useBookPlan(meta: BookMeta | null, records: BookRecordSource[]) {
  const [bytes, setBytes] = useState<Record<FontKey, Uint8Array> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadFontBytes().then(setBytes, (e: Error) => setError(e.message));
  }, []);
  const plan = useMemo<{ plan: BookPlan; fonts: BookFonts } | null>(() => {
    if (!bytes || !meta) return null;
    const fonts = createBookFonts(bytes);
    return { plan: buildPlan(meta, records, fonts), fonts };
  }, [bytes, meta, records]);
  return { plan: plan?.plan ?? null, fonts: plan?.fonts ?? null, error };
}

export function BookPreview({ plan, fonts, jumpTo }: { plan: BookPlan; fonts: BookFonts; jumpTo?: number | null }) {
  const [spread, setSpread] = useState(true);
  const [zoom, setZoom] = useState(0.62);
  const [current, setCurrent] = useState(1);
  const [guides, setGuides] = useState(false);
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const total = plan.pages.length;

  useEffect(() => {
    if (jumpTo) setCurrent(jumpTo);
  }, [jumpTo]);
  useEffect(() => {
    if (current > total) setCurrent(Math.max(1, total));
  }, [total, current]);
  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Spreads: page 1 sits alone on the right, then 2–3, 4–5, …
  const visible: Array<PlannedPage | null> = spread
    ? current === 1
      ? [null, plan.pages[0] ?? null]
      : (() => {
          const left = current % 2 === 0 ? current : current - 1;
          return [plan.pages[left - 1] ?? null, plan.pages[left] ?? null];
        })()
    : [plan.pages[current - 1] ?? null];
  const step = spread ? (current === 1 ? 1 : 2) : 1;
  const go = (d: number) => {
    if (spread) {
      if (d > 0) setCurrent((c) => Math.min(total, c === 1 ? 2 : (c % 2 === 0 ? c : c - 1) + 2));
      else setCurrent((c) => Math.max(1, c <= 3 ? 1 : (c % 2 === 0 ? c : c - 1) - 2));
    } else setCurrent((c) => Math.min(total, Math.max(1, c + d * step)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const asc = fonts.regular.ascent / fonts.regular.unitsPerEm;
  const lineH = (fonts.regular.ascent - fonts.regular.descent) / fonts.regular.unitsPerEm;
  const scale = full ? Math.min(window.innerHeight / plan.heightPt, window.innerWidth / (plan.widthPt * (spread ? 2 : 1))) * 0.92 : zoom;

  return (
    <div ref={box} className={full ? "flex h-full flex-col bg-muted" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-3 p-1 text-sm">
        <Button size="icon" variant="outline" onClick={() => go(-1)} aria-label="Previous page" disabled={current <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          Page{" "}
          <input
            className="w-12 rounded border bg-background px-1 text-center"
            value={current}
            onChange={(e) => setCurrent(Math.min(total, Math.max(1, Number(e.target.value) || 1)))}
            aria-label="Page number"
          />{" "}
          of {total}
        </span>
        <Button size="icon" variant="outline" onClick={() => go(1)} aria-label="Next page" disabled={current >= total}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="spread" checked={spread} onCheckedChange={setSpread} />
          <Label htmlFor="spread">Facing pages</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="guides" checked={guides} onCheckedChange={setGuides} />
          <Label htmlFor="guides">Margins &amp; resolution</Label>
        </div>
        {!full && (
          <div className="flex w-36 items-center gap-2">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider min={0.3} max={1.6} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())}
        >
          {full ? <Minimize2 className="mr-1 h-4 w-4" /> : <Maximize2 className="mr-1 h-4 w-4" />}
          {full ? "Exit full screen" : "Full screen"}
        </Button>
      </div>
      <div className={`overflow-auto rounded-md bg-muted/60 p-4 ${full ? "flex flex-1 items-center justify-center" : ""}`}>
        <div className="mx-auto flex w-max gap-0.5">
          {visible.map((p, i) =>
            p ? (
              <PageView key={p.index} page={p} plan={plan} scale={scale} asc={asc} lineH={lineH} guides={guides} />
            ) : (
              <div key={`empty-${i}`} style={{ width: plan.widthPt * scale, height: plan.heightPt * scale }} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function PageView({ page, plan, scale, asc, lineH, guides }: { page: PlannedPage; plan: BookPlan; scale: number; asc: number; lineH: number; guides: boolean }) {
  const recto = page.index % 2 === 1;
  const left = recto ? LAYOUT.marginInside : LAYOUT.marginOutside;
  const right = recto ? LAYOUT.marginOutside : LAYOUT.marginInside;
  return (
    <div
      className="relative overflow-hidden shadow-md"
      style={{ width: plan.widthPt * scale, height: plan.heightPt * scale, background: "var(--book-paper)", color: "var(--book-ink)" }}
      aria-label={`Page ${page.index}`}
    >
      {page.kind === "blank" && guides && (
        <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: "var(--book-muted)" }}>
          Blank page
        </span>
      )}
      {page.elements.map((el, i) => {
        if (el.t === "image")
          return (
            <div key={i} className="absolute" style={{ left: el.x * scale, top: el.y * scale, width: el.w * scale, height: el.h * scale }}>
              {el.image.previewUrl ? (
                <img src={el.image.previewUrl} alt={el.image.label} className="h-full w-full" style={{ objectFit: "fill" }} loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center border text-xs">{el.image.label}</div>
              )}
              {guides && (
                <span
                  className="absolute right-1 top-1 rounded px-1 text-[10px] font-medium text-background"
                  style={{ background: el.dpi >= PRINT_DPI_GOOD ? "var(--book-muted)" : el.dpi >= PRINT_DPI_MIN ? "var(--book-ink)" : "var(--book-guide)" }}
                >
                  {el.dpi ? `${el.dpi} DPI` : "? DPI"} · {el.image.source === "print" ? "print copy" : el.image.source === "view" ? "viewing copy" : "master"}
                </span>
              )}
            </div>
          );
        if (el.t === "rule")
          return <div key={i} className="absolute" style={{ left: el.x * scale, top: el.y * scale, width: el.w * scale, borderTop: "0.5px solid var(--book-muted)" }} />;
        return (
          <span
            key={i}
            className="absolute whitespace-pre"
            style={{
              left: el.x * scale,
              top: (el.y - asc * el.size) * scale,
              fontFamily: "BookGaramond, serif",
              fontSize: el.size * scale,
              lineHeight: lineH,
              color: el.tone === "muted" ? "var(--book-muted)" : "var(--book-ink)",
              fontKerning: "none",
              ...FONT_CSS[el.font],
            }}
          >
            {el.text}
          </span>
        );
      })}
      {guides && (
        <div
          className="pointer-events-none absolute border border-dashed"
          style={{
            borderColor: "var(--book-guide)",
            left: left * scale,
            right: right * scale,
            top: LAYOUT.marginTop * scale,
            bottom: LAYOUT.marginBottom * scale,
          }}
        />
      )}
    </div>
  );
}
