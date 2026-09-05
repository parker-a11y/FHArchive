import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ISO_DATE } from "@/lib/on-this-date";

/**
 * Wraps a *historical* date (record, letter, postmark, photograph, event date)
 * so it opens the On This Date view. Administrative dates — uploads, edits,
 * AI processing, account activity — must never use this.
 */
export function DateLink({
  date,
  children,
  className = "",
}: {
  date: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const iso = date?.slice(0, 10);
  if (!iso || !ISO_DATE.test(iso)) return <>{children}</>;
  return (
    <Link
      to="/on-this-date/$date"
      params={{ date: iso }}
      title="What was happening this day?"
      className={`underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 hover:text-primary hover:decoration-primary ${className}`}
    >
      {children}
    </Link>
  );
}
