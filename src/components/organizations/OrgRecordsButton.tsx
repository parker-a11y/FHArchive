import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  orgId: string;
  name: string;
  /** Trigger element (a button). */
  children: ReactNode;
};

type LinkedLetter = { id: string; archive_id: string; title: string | null; role: string };
type LinkedSource = { id: string; ds_id: string; title: string; role: string };

/** Dialog listing every FH record and Digital Source linked to an organization. */
export function OrgRecordsButton({ orgId, name, children }: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["org-records", orgId],
    enabled: open,
    queryFn: async () => {
      const [{ data: lp, error: e1 }, { data: dp, error: e2 }] = await Promise.all([
        (supabase.from("letter_organizations") as any)
          .select("role, letters(id, archive_id, title)")
          .eq("organization_id", orgId),
        (supabase.from("ds_organizations") as any)
          .select("role, digital_sources(id, ds_id, title)")
          .eq("organization_id", orgId),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const letters: LinkedLetter[] = (lp ?? [])
        .filter((r: any) => r.letters)
        .map((r: any) => ({
          id: r.letters.id,
          archive_id: r.letters.archive_id,
          title: r.letters.title,
          role: r.role,
        }));
      const sources: LinkedSource[] = (dp ?? [])
        .filter((r: any) => r.digital_sources)
        .map((r: any) => ({
          id: r.digital_sources.id,
          ds_id: r.digital_sources.ds_id,
          title: r.digital_sources.title,
          role: r.role,
        }));
      return { letters, sources };
    },
  });

  const total = (data?.letters.length ?? 0) + (data?.sources.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Records matching “{name}”</DialogTitle>
          <DialogDescription>
            Every archive record and digital source linked to this organization.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="py-4 text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && total === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            No records are linked to this organization yet.
          </p>
        )}

        {!!data?.letters.length && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              FH Records ({data.letters.length})
            </p>
            <div className="divide-y divide-border rounded border border-border">
              {data.letters.map((l) => (
                <Link
                  key={l.id}
                  to="/letters/$archiveId"
                  params={{ archiveId: l.archive_id }}
                  className="flex items-baseline gap-3 px-3 py-2 text-sm hover:bg-muted/60"
                  onClick={() => setOpen(false)}
                >
                  <span className="font-mono font-medium">{l.archive_id}</span>
                  <span className="flex-1 truncate">{l.title ?? "Untitled"}</span>
                  <span className="text-xs text-muted-foreground">{l.role}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!!data?.sources.length && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Digital Sources ({data.sources.length})
            </p>
            <div className="divide-y divide-border rounded border border-border">
              {data.sources.map((s) => (
                <Link
                  key={s.id}
                  to="/sources/$dsId"
                  params={{ dsId: s.ds_id }}
                  className="flex items-baseline gap-3 px-3 py-2 text-sm hover:bg-muted/60"
                  onClick={() => setOpen(false)}
                >
                  <span className="font-mono font-medium">{s.ds_id}</span>
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="text-xs text-muted-foreground">{s.role}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
