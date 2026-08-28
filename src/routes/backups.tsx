import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CloudUpload, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { triggerBackup } from "@/lib/backup.functions";

export const Route = createFileRoute("/backups")({
  head: () => ({
    meta: [
      { title: "Backups — Harrington Family Archive" },
      {
        name: "description",
        content:
          "Nightly off-site backups of every archive record, scan and uploaded file to Google Drive.",
      },
      { property: "og:title", content: "Backups — Harrington Family Archive" },
      {
        property: "og:description",
        content: "Monitor nightly Google Drive backups of the family archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <Backups />
    </AppShell>
  ),
});

function bytes(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  db_rows: number;
  files_uploaded: number;
  files_pending: number;
  bytes_uploaded: number;
  error: string | null;
};

function Backups() {
  const qc = useQueryClient();
  const run = useServerFn(triggerBackup);
  const [busy, setBusy] = useState(false);

  const { data: runs = [] } = useQuery({
    queryKey: ["backup_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Run[];
    },
  });

  const { data: fileStats } = useQuery({
    queryKey: ["backup_files_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("backup_files")
        .select("id", { count: "exact", head: true });
      return { count: count ?? 0 };
    },
  });

  const last = runs.find((r) => r.status === "success" || r.status === "partial");

  async function backupNow() {
    setBusy(true);
    try {
      const result = await run({});
      if (result.status === "error") {
        toast.error(`Backup failed: ${result.error}`);
      } else {
        toast.success(
          `Backup ${result.status === "partial" ? "partially " : ""}complete — ${result.dbRows} records, ${result.filesUploaded} new files copied.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["backup_runs"] });
      qc.invalidateQueries({ queryKey: ["backup_files_count"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Backups"
        description="Nightly off-site copy of the entire archive to Google Drive"
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={<ShieldCheck className="size-5" />}
            label="Last successful backup"
            value={
              last?.finished_at
                ? new Date(last.finished_at).toLocaleString()
                : "Not yet run"
            }
          />
          <StatCard
            icon={<HardDrive className="size-5" />}
            label="Files copied to Drive"
            value={String(fileStats?.count ?? 0)}
          />
          <StatCard
            icon={<CloudUpload className="size-5" />}
            label="Destination folder"
            value="Harrington Family Archive Backups"
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">How it works</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Every night a complete JSON export of every table (records, items, people,
                places, keywords, digital sources, edit history) is written to your Google
                Drive, and every scan or uploaded file that hasn&apos;t been copied yet is
                mirrored alongside it. Nothing is ever deleted from Drive, so a full
                rebuild is always possible.
              </p>
            </div>
            <Button onClick={backupNow} disabled={busy} className="gap-2">
              <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
              {busy ? "Backing up…" : "Back up now"}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Records</th>
                <th className="px-4 py-3">New files</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 sm:py-8 text-center text-muted-foreground">
                    No backups have run yet.
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "success"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "partial"
                            ? "bg-amber-100 text-amber-900"
                            : r.status === "running"
                              ? "bg-muted text-muted-foreground"
                              : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.db_rows}</td>
                  <td className="px-4 py-3">
                    {r.files_uploaded}
                    {r.files_pending ? ` (${r.files_pending} pending)` : ""}
                  </td>
                  <td className="px-4 py-3">{bytes(r.bytes_uploaded)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-archive-gold">{icon}</div>
      <p className="mt-3 text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
