import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TRANSCRIPTION_STATUS } from "@/lib/archive";
import { logEdits, type Letter } from "@/lib/queries";
import { fetchDigitalFiles } from "@/lib/digital-files";
import {
  bestText,
  fetchScanTranscriptions,
  isEnvelopePage,
  saveCorrections,
  transcriptionStatusLabel,
  transcriptionStatusTone,
  type ScanTranscription,
} from "@/lib/transcription";
import { transcribeRecord, transcribeScans } from "@/lib/transcription.functions";

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[11px] font-medium ${transcriptionStatusTone(status)}`}
    >
      {transcriptionStatusLabel(status)}
    </span>
  );
}

/** One scan: original image on the left, editable transcription on the right. */
function PageEditor({
  file,
  record,
  selected,
  onSelect,
  onTranscribe,
  busy,
  onSaved,
}: {
  file: { id: string; label: string | null; original_filename: string; viewUrl: string; rotation: number };
  record: ScanTranscription | undefined;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onTranscribe: () => void;
  busy: boolean;
  onSaved: () => void;
}) {
  const [text, setText] = useState(record?.verified_text ?? record?.ai_text ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setText(record?.verified_text ?? record?.ai_text ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.verified_text, record?.ai_text]);

  async function save(verify: boolean) {
    if (!record) return toast.error("Transcribe this scan first.");
    try {
      await saveCorrections(record.id, text, verify);
      setDirty(false);
      onSaved();
      toast.success(verify ? "Marked human verified" : "Corrections saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
        <span className="text-sm font-medium">{file.label || file.original_filename}</span>
        <StatusPill status={record?.status} />
        {isEnvelopePage(file.label, file.original_filename) && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            envelope — kept out of combined text
          </span>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={onTranscribe} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-3.5" />
          )}
          Transcribe with ChatGPT
        </Button>
      </div>

      {record?.error && <p className="mb-2 text-xs text-destructive">{record.error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded border border-border bg-muted/30 p-2">
          {file.viewUrl ? (
            <img
              src={file.viewUrl}
              alt={file.label || file.original_filename}
              style={{ transform: `rotate(${file.rotation}deg)` }}
              className="max-h-[60vh] w-full object-contain"
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No web-viewable copy for this scan.</p>
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            rows={16}
            className="font-mono text-sm"
            placeholder="Transcription — AI output appears here and can be corrected."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => save(false)} disabled={!record}>
              Save Corrections
            </Button>
            <Button size="sm" variant="outline" onClick={() => save(true)} disabled={!record}>
              <BadgeCheck className="mr-1 size-3.5" /> Mark Human Verified
            </Button>
            {record?.ai_text && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Original AI transcription</summary>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-archive-ai/40 bg-archive-ai-surface p-2 text-[11px]">
                  {record.ai_text}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TranscriptionPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const [verified, setVerified] = useState(letter.transcription_verified ?? "");
  const [status, setStatus] = useState(letter.transcription_status);
  const [selected, setSelected] = useState<string[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [recordBusy, setRecordBusy] = useState(false);

  useEffect(() => {
    setVerified(letter.transcription_verified ?? "");
    setStatus(letter.transcription_status);
  }, [letter.id, letter.transcription_verified, letter.transcription_status]);

  const { data: files = [] } = useQuery({
    queryKey: ["digital-files", letter.id],
    queryFn: () => fetchDigitalFiles(letter.id),
  });
  const { data: transcripts = [], refetch } = useQuery({
    queryKey: ["scan-transcriptions", letter.id],
    queryFn: () => fetchScanTranscriptions(letter.id),
  });

  const byFile = useMemo(() => {
    const m: Record<string, ScanTranscription> = {};
    transcripts.forEach((t) => (m[t.file_id] = t));
    return m;
  }, [transcripts]);

  const refreshLetter = () => {
    qc.invalidateQueries({ queryKey: ["letter", letter.archive_id] });
    qc.invalidateQueries({ queryKey: ["letters"] });
  };

  async function runScans(ids: string[]) {
    if (!ids.length) return;
    setBusyIds((b) => [...b, ...ids]);
    try {
      const results = await transcribeScans({ data: { fileIds: ids } });
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      if (ok) toast.success(`${ok} scan${ok === 1 ? "" : "s"} transcribed`);
      failed.forEach((f) => toast.error(f.error ?? "Transcription failed"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyIds((b) => b.filter((id) => !ids.includes(id)));
      refetch();
    }
  }

  async function runRecord(force: boolean) {
    setRecordBusy(true);
    try {
      const r = await transcribeRecord({ data: { letterId: letter.id, force } });
      if (r.error) toast.error(r.error);
      else
        toast.success(
          `${r.pages} page${r.pages === 1 ? "" : "s"} transcribed${r.failed ? `, ${r.failed} failed` : ""}`,
        );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRecordBusy(false);
      refetch();
      refreshLetter();
    }
  }

  async function saveCombined() {
    const { error } = await supabase
      .from("letters")
      .update({ transcription_verified: verified || null, transcription_status: status })
      .eq("id", letter.id);
    if (error) return toast.error(error.message);
    await logEdits(
      letter.id,
      {
        transcription_verified: letter.transcription_verified,
        transcription_status: letter.transcription_status,
      },
      { transcription_verified: verified, transcription_status: status },
    );
    refreshLetter();
    toast.success("Combined transcription saved");
  }

  function copyAiIntoVerified() {
    if (
      verified.trim() &&
      !confirm("This will replace the combined verified transcription in the editor. Continue?")
    )
      return;
    setVerified(letter.transcription_raw_ai ?? "");
    toast.message("AI text copied into the editor — review, then save.");
  }

  const pageCoverage = files.filter((f) => bestText(byFile[f.id] ?? { ai_text: "", verified_text: "" })).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded border border-border bg-muted/30 p-3">
        <Button onClick={() => runRecord(false)} disabled={recordBusy || files.length === 0}>
          {recordBusy ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 size-4" />
          )}
          Transcribe Entire Record
        </Button>
        <Button variant="outline" onClick={() => runRecord(true)} disabled={recordBusy || !files.length}>
          Re-transcribe all pages
        </Button>
        <Button
          variant="outline"
          disabled={!selected.length || recordBusy}
          onClick={() => runScans(selected)}
        >
          Transcribe Selected ({selected.length})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(selected.length ? [] : files.map((f) => f.id))}
        >
          {selected.length ? "Clear selection" : "Select all pages"}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {pageCoverage} of {files.length} scans transcribed · masters are never altered
        </span>
      </div>

      {/* Per-page transcriptions */}
      <div className="space-y-4">
        {files.length === 0 && (
          <p className="rounded border border-border bg-card p-6 text-sm text-muted-foreground">
            No scans uploaded yet — add scans in the Digitization tab to transcribe them.
          </p>
        )}
        {files.map((f) => (
          <PageEditor
            key={f.id}
            file={f}
            record={byFile[f.id]}
            selected={selected.includes(f.id)}
            onSelect={(v) =>
              setSelected((s) => (v ? [...new Set([...s, f.id])] : s.filter((x) => x !== f.id)))
            }
            onTranscribe={() => runScans([f.id])}
            busy={busyIds.includes(f.id)}
            onSaved={() => refetch()}
          />
        ))}
      </div>

      {/* Combined record-level transcription */}
      <div className="rounded border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold">Combined record transcription</h4>
          <StatusPill status={letter.transcription_status} />
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={!letter.transcription_raw_ai}
            onClick={copyAiIntoVerified}
          >
            Copy AI text into verified
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <span className="field-label">Combined AI transcription (read-only)</span>
            <div className="mt-1.5 max-h-72 overflow-auto rounded border border-archive-ai/40 bg-archive-ai-surface p-3 text-sm whitespace-pre-wrap">
              {letter.transcription_raw_ai || (
                <span className="text-muted-foreground">
                  None yet. “Transcribe Entire Record” assembles the letter pages here in scan
                  order; envelope pages are excluded.
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="field-label">Verified transcription</span>
            <Textarea
              rows={14}
              className="mt-1.5 font-mono text-sm"
              value={verified}
              onChange={(e) => setVerified(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-3">
              <select
                className="h-9 rounded border border-input bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {TRANSCRIPTION_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Button onClick={saveCombined}>Save transcription</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
