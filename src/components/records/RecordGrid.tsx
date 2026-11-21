import { useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { moveColumn } from "@/lib/column-order";
import { type Col } from "@/lib/record-columns";

export type GridSort = { key: string; dir: 1 | -1 };
export type GridLayoutProps = {
  cols: Col[];
  widths: Record<string, number>;
  setWidths: Dispatch<SetStateAction<Record<string, number>>>;
  columnOrder: string[];
  saveColumnOrder: (order: string[]) => void;
  sort: GridSort;
  setSort: Dispatch<SetStateAction<GridSort>>;
  selectionHeader: ReactNode;
  children: ReactNode;
};
export function RecordGrid({ cols, widths, setWidths, columnOrder, saveColumnOrder, sort, setSort, selectionHeader, children }: GridLayoutProps) {
 const draggedColumn = useRef<string | null>(null);
 const [columnDrop, setColumnDrop] = useState<{key: string; after: boolean} | null>(null);
 const tableWidth = 32 + cols.reduce((total,c) => total + (widths[c.key] ?? c.width), 0);
 return <div className="overflow-x-auto"><table className="min-w-full table-fixed border-collapse text-sm" style={{width:tableWidth}}>
 <colgroup><col style={{width:32}} />{cols.map(c => <col key={c.key} style={{width:widths[c.key] ?? c.width}} />)}</colgroup>
          <thead className="sticky top-0 bg-secondary">
            <tr>
              <th className="sticky left-0 z-20 w-8 border-b border-r border-border bg-secondary px-2 py-2">
                {selectionHeader}
               </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  style={{ width: widths[c.key] ?? c.width }}
                  className={cn(
                    "relative border-b border-border px-3 py-2 text-left font-medium select-none",
                    columnDrop?.key === c.key && (columnDrop.after ? "border-r-2 border-r-primary" : "border-l-2 border-l-primary"),
                  )}
                  onDragOver={(e) => {
                    if (!draggedColumn.current) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const bounds = e.currentTarget.getBoundingClientRect();
                    setColumnDrop({ key: c.key, after: e.clientX > bounds.left + bounds.width / 2 });
                  }}
                  onDrop={(e) => {
                    const source = draggedColumn.current;
                    if (!source) return;
                    e.preventDefault();
                    const bounds = e.currentTarget.getBoundingClientRect();
                    saveColumnOrder(moveColumn(columnOrder, source, c.key, e.clientX > bounds.left + bounds.width / 2));
                    draggedColumn.current = null;
                    setColumnDrop(null);
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-1 inline-flex size-5 cursor-grab text-muted-foreground active:cursor-grabbing"
                    aria-label={`Move ${c.label} column`}
                    title={`Drag ${c.label} to rearrange; Alt + arrow keys to move`}
                    draggable
                    onDragStart={(e) => {
                      draggedColumn.current = c.key;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", c.key);
                    }}
                    onDragEnd={() => { draggedColumn.current = null; setColumnDrop(null); }}
                    onKeyDown={(e) => {
                      if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                      e.preventDefault();
                      const direction = e.key === "ArrowLeft" ? -1 : 1;
                      const adjacent = cols[cols.findIndex((col) => col.key === c.key) + direction];
                      if (adjacent) saveColumnOrder(moveColumn(columnOrder, c.key, adjacent.key, direction === 1));
                    }}
                  >
                    <GripVertical className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="field-label h-auto px-0 py-0 hover:bg-transparent hover:text-foreground"
                    disabled={c.key === "collections"}
                    onClick={() =>
                      setSort((s) =>
                        s.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 },
                      )
                    }
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </Button>
                  <span
                    role="separator"
                    onMouseDown={(e) => {
                      const startX = e.clientX;
                      const startW = widths[c.key] ?? c.width;
                      const minW = c.minWidth ?? 60;
                      const move = (ev: MouseEvent) =>
                        setWidths((w) => ({
                          ...w,
                          [c.key]: Math.max(minW, startW + ev.clientX - startX),
                        }));
                       const up = () => {
                         window.removeEventListener("mousemove", move);
                         window.removeEventListener("mouseup", up);
                         setWidths((w) => {
                           try {
                             localStorage.setItem("letters_col_widths", JSON.stringify(w));
                           } catch {
                             /* storage unavailable */
                           }
                           return w;
                         });
                       };
                      window.addEventListener("mousemove", move);
                      window.addEventListener("mouseup", up);
                    }}
                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/40"
                  />
                </th>
              ))}
            </tr>
          </thead>
<tbody>{children}</tbody></table></div>;
}
export const gridRowClass = (index: number, compact = false) => cn("group border-b border-border hover:bg-muted/50", index % 2 === 1 && "bg-muted/30", compact && "leading-tight");
export const gridSelectionClass = (index: number, compact = false) => cn("sticky left-0 z-10 border-r border-border bg-background px-2 align-top before:pointer-events-none before:absolute before:inset-0 group-hover:before:bg-muted/50", index % 2 === 1 && "before:bg-muted/30", compact ? "py-0.5" : "py-1.5");
export const gridCellClass = (compact = false) => cn("truncate align-top", compact ? "px-2 py-0.5" : "px-3 py-1.5");
