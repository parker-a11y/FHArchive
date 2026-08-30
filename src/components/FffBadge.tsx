import fffBadge from "@/assets/fff-badge.png";
import { cn } from "@/lib/utils";

/** FFF — Francis File Find. The archive's headline highlight mark. */
export const FFF_NAME = "Francis File Find";
export const FFF_SHORT = "FFF";
export const FFF_PLURAL = "Francis File Finds";

export function FffBadge({
  className,
  muted = false,
  size = 20,
}: {
  className?: string;
  /** Dimmed treatment for the "not yet marked" state. */
  muted?: boolean;
  size?: number;
}) {
  return (
    <img
      src={fffBadge}
      alt=""
      aria-hidden
      loading="lazy"
      width={size}
      height={size}
      className={cn("shrink-0 select-none", muted && "opacity-30 grayscale", className)}
      style={{ width: size, height: size }}
    />
  );
}
