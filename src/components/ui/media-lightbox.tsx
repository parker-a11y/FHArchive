"use client";

import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LightboxItem = {
  id: string;
  url: string;
  type: "image" | "audio" | "video" | "document";
  title: string;
  subtitle?: string;
  filename?: string | null;
  rotation?: number;
};

export function MediaLightbox({
  items,
  initialIndex = 0,
  open,
  onClose,
  onRotationChange,
}: {
  items: LightboxItem[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  onRotationChange?: (id: string, rotation: number) => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setZoom(1);
      setRotation(items[initialIndex]?.rotation ?? 0);
    }
  }, [open, initialIndex, items]);

  const item = items[index];

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;
    const next = (index - 1 + items.length) % items.length;
    setIndex(next);
    setZoom(1);
    setRotation(items[next]?.rotation ?? 0);
  }, [index, items]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    const next = (index + 1) % items.length;
    setIndex(next);
    setZoom(1);
    setRotation(items[next]?.rotation ?? 0);
  }, [index, items]);

  const rotate = useCallback(() => {
    const next = (rotation + 90) % 360;
    setRotation(next);
    if (item && onRotationChange) onRotationChange(item.id, next);
  }, [rotation, item, onRotationChange]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, handlePrev, handleNext]);

  if (!open || !item) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      {/* Toolbar */}
      <div className="no-print flex items-center justify-between px-4 py-3 text-white/90">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {item.subtitle && <p className="truncate text-xs text-white/60">{item.subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {item.type === "image" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                <ZoomOut className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:bg-white/10 hover:text-white"
                onClick={rotate}
              >
                <RotateCw className="size-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            asChild
          >
            <a href={item.url} download={item.filename ?? undefined} target="_blank" rel="noreferrer">
              <Download className="size-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4">
        {items.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="no-print absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          >
            <ChevronLeft className="size-6" />
          </Button>
        )}

        <div className="flex h-full w-full items-center justify-center">
          {item.type === "image" && (
            <img
              src={item.url}
              alt={item.title}
              draggable={false}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: "transform 150ms ease-out",
              }}
              className={cn(
                "max-h-full max-w-full object-contain",
                zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default",
              )}
            />
          )}
          {item.type === "audio" && (
            <div className="w-full max-w-xl rounded-xl bg-card p-6 text-card-foreground">
              <p className="mb-4 text-lg font-medium">{item.title}</p>
              <audio controls src={item.url} className="w-full" autoPlay />
            </div>
          )}
          {item.type === "video" && (
            <video controls src={item.url} className="max-h-full max-w-full" autoPlay />
          )}
          {item.type === "document" && (
            <div className="rounded-xl bg-card p-8 text-center text-card-foreground">
              <p className="text-lg font-medium">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Document preview is not available. Use the download button to open it.
              </p>
            </div>
          )}
        </div>

        {items.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="no-print absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          >
            <ChevronRight className="size-6" />
          </Button>
        )}
      </div>

      {/* Footer / counter */}
      <div className="no-print flex items-center justify-between px-4 py-2 text-xs text-white/60">
        <span>{item.filename || item.title}</span>
        {items.length > 1 && (
          <span>
            {index + 1} / {items.length}
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}
