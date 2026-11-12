import { useEffect, useRef, type ReactNode } from "react";

/** Shared physical print bounds; only the content shrinks, never the label stock. */
export function LabelFrame({ children }: { children: ReactNode }) {
  const area = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bounds = area.current;
    const face = content.current;
    if (!bounds || !face) return;
    const fit = () => {
      if (!bounds.clientWidth || !face.offsetHeight) return;
      const scale = Math.min(1, bounds.clientWidth / face.scrollWidth, bounds.clientHeight / face.scrollHeight);
      // Measured geometry must be identical in the preview and body-level print portal.
      face.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(bounds);
    observer.observe(face);
    fit();
    void document.fonts.ready.then(fit);
    window.addEventListener("beforeprint", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", fit);
    };
  }, [children]);

  return (
    <div className="label-stock">
      <div ref={area} className="label-safe-area">
        <div ref={content} className="label-fitted-content">{children}</div>
      </div>
    </div>
  );
}