import { ExternalLink, Maximize2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SignedImg } from "@/components/photos/SignedImg";
import { type Photo } from "@/lib/photos";
import { type PhotoRecordRef } from "@/lib/photo-links";

export type Density = "sm" | "md" | "lg";

/** Smallest tile width per density; the browser fits as many columns as fit. */
export const GRID_MIN_PX: Record<Density, number> = { sm: 116, md: 164, lg: 232 };

type Props = {
  rows: Photo[];
  sel: ReadonlySet<string>;
  /** Click on a tile: shift extends from the last clicked tile. */
  onPick: (id: string, shift: boolean) => void;
  catNames: (p: Photo) => string[];
  sleeveOf: (p: Photo) => string | null;
  boxOf: (p: Photo) => string | null;
  recOf: (p: Photo) => PhotoRecordRef | null;
  onZoom: (id: string) => void;
  density: Density;
};

/**
 * Thumbnail grid over the same filtered, sorted rows the table shows. Selection
 * works exactly as in the list (click to toggle, Shift-click for a range) so the
 * bulk bar above behaves the same in either view.
 */
export function PhotoGrid({ rows, sel, onPick, catNames, sleeveOf, boxOf, recOf, onZoom, density }: Props) {
  if (!rows.length) {
    return <p className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No photographs match these filters.</p>;
  }
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_PX[density]}px, 1fr))` }}>
      {rows.map((p) => {
        const on = sel.has(p.id);
        const rec = recOf(p);
        const cats = catNames(p);
        const sleeve = sleeveOf(p);
        const box = boxOf(p);
        return (
          <div
            key={p.id}
            onClick={(e) => onPick(p.id, e.shiftKey)}
            onDoubleClick={() => rec && window.open(rec.href, "_blank", "noopener")}
            title={rec ? `Click to select · double-click to open the ${rec.archive_id} record` : "Click to select"}
            className={`group relative flex cursor-pointer select-none flex-col overflow-hidden rounded-md border transition ${
              on ? "border-primary bg-accent/60 ring-2 ring-primary/40" : "border-border hover:border-primary/50 hover:bg-muted/40"
            }`}
          >
            <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted">
              <SignedImg path={p.front_thumb_path ?? p.front_view_path} alt="" className="h-full w-full object-contain" />
              <span className="absolute left-1 top-1 rounded bg-background/80 p-0.5 backdrop-blur" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  aria-label={`Select ${p.ph_id ?? "photograph"}`}
                  checked={on}
                  onClick={(e) => { e.preventDefault(); onPick(p.id, e.shiftKey); }}
                />
              </span>
              <button
                type="button"
                aria-label={`View ${p.ph_id ?? "photograph"} full size`}
                title="View full size"
                onClick={(e) => { e.stopPropagation(); onZoom(p.id); }}
                className="absolute right-1 top-1 rounded bg-background/80 p-1 text-muted-foreground opacity-0 backdrop-blur transition focus-visible:opacity-100 group-hover:opacity-100 hover:text-foreground"
              >
                <Maximize2 className="size-3.5" />
              </button>
              {p.back_path && (
                <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground backdrop-blur">reverse</span>
              )}
            </div>
            <div className="min-w-0 space-y-0.5 px-2 py-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[11px]">{p.ph_id ?? "—"}</span>
                {rec && (
                  <a
                    href={rec.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`Open the ${rec.archive_id} record`}
                    className="flex w-fit items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {rec.archive_id}<ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="truncate text-xs" title={p.caption ?? ""}>{p.caption || <span className="text-muted-foreground">No subtitle</span>}</p>
              <p className="truncate text-[11px] text-muted-foreground" title={cats.join(", ")}>{cats.join(", ") || "Uncategorized"}</p>
              {(sleeve || box) && (
                <p className="truncate font-mono text-[10px] text-muted-foreground" title={[sleeve, box].filter(Boolean).join(" · ")}>
                  {[sleeve, box].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
