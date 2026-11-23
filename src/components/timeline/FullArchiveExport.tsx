import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildFullCsv, fullArchiveFilename, storedTranscription } from "@/lib/timeline-export";
import { downloadBlob, loadRows, type Letter } from "./TimelineSummaryExport";

const SLIM =
  "id, fh_seq, archive_id, title, author, recipient, origin, destination, normalized_date, date_as_written, date_end, date_precision, date_certainty, date_from_postmark, record_type";

/** Every catalogued record (paged past the 1000-row limit) with its full stored transcription. */
async function buildFullArchive(): Promise<string> {
  const letters: Letter[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("letters")
      .select(SLIM)
      .neq("record_type", "moved_to_gallery")
      .order("fh_seq", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    letters.push(...((data ?? []) as unknown as Letter[]));
    if (!data || data.length < 1000) break;
  }
  const texts = new Map<string, string>();
  const ids = letters.map((l) => l.id);
  for (let i = 0; i < ids.length; i += 40) {
    const { data, error } = await supabase
      .from("letters")
      .select("id, transcription_verified, transcription_rollup_text, transcription_raw_ai")
      .in("id", ids.slice(i, i + 40));
    if (error) throw error;
    (data ?? []).forEach((r) => texts.set(r.id, storedTranscription(r)));
  }
  const rows = await loadRows(letters);
  const byArchive = new Map(letters.map((l) => [l.archive_id, l.id]));
  return buildFullCsv(rows.map((r) => ({ ...r, transcription: texts.get(byArchive.get(r.archiveId) ?? "") ?? "" })));
}

export function FullArchiveExport() {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null);

  if (ready) {
    return (
      <Button size="sm" className="gap-2" onClick={() => { downloadBlob(ready.blob, ready.name); setReady(null); }}>
        <FileDown className="size-4" /> Download {ready.name}
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const csv = await buildFullArchive();
          setReady({ blob: new Blob([csv], { type: "text/csv;charset=utf-8" }), name: fullArchiveFilename(new Date()) });
        } catch (e) {
          toast.error((e as Error).message || "Could not build the full archive export");
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileDown className="size-4" /> {busy ? "Building full archive…" : "Export Full Archive (CSV)"}
    </Button>
  );
}
