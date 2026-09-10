import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureRecordShareLink } from "@/lib/record-share-link.functions";

/**
 * One tap: makes sure the record has a public read-only link and copies it to
 * the clipboard, so it can be pasted straight into an email or text message.
 */
export function CopyShareLinkButton({
  letterId,
  size = "icon",
  label,
  className,
}: {
  letterId: string;
  size?: "icon" | "sm";
  label?: string;
  className?: string;
}) {
  const ensure = useServerFn(ensureRecordShareLink);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await ensure({ data: { letterId } });
      try {
        await navigator.clipboard.writeText(res.url);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
        toast.success(res.created ? "Share link created and copied" : "Share link copied", {
          description: res.url,
        });
      } catch {
        toast.message("Share link ready — copy it below", { description: res.url });
      }
    } catch (error) {
      toast.error((error as Error).message || "Could not create a share link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={className}
      onClick={copy}
      disabled={busy}
      title="Copy a public link to this record"
      aria-label="Copy a public link to this record"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : done ? (
        <Check className="size-4 text-emerald-600" />
      ) : (
        <Link2 className="size-4" />
      )}
      {label ? <span className="ml-1.5">{label}</span> : null}
    </Button>
  );
}
