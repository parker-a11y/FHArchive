import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TRANSCRIPTION_STATUS } from "@/lib/archive";
import { logEdits, type Letter } from "@/lib/queries";

export function TranscriptionPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const [verified, setVerified] = useState(letter.transcription_verified ?? "");
  const [status, setStatus] = useState(letter.transcription_status);
  const [scanUrl, setScanUrl] = useState("");

  useEffect(() => {
    setVerified(letter.transcription_verified ?? "");
    setStatus(letter.transcription_status);
  }, [letter.id, letter.transcription_verified, letter.transcription_status]);

  useQuery({
    queryKey: ["first_scan", letter.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("letter_scans")
        .select("storage_path")
        .eq("letter_id", letter.id)
        .order("sort_order")
        .limit(1);
      const path = data?.[0]?.storage_path as string | undefined;
      if (path) {
        const { data: s } = await supabase.storage.from("scans").createSignedUrl(path, 3600);
        setScanUrl(s?.signedUrl ?? "");
      }
      return path ?? null;
    },
  });

  async function save() {
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
    qc.invalidateQueries({ queryKey: ["letter", letter.archive_id] });
    qc.invalidateQueries({ queryKey: ["letters"] });
    toast.success("Verified transcription saved");
  }

  function copyAiIntoVerified() {
    if (
      verified.trim() &&
      !confirm("This will replace your verified transcription text in the editor. Continue?")
    )
      return;
    setVerified(letter.transcription_raw_ai ?? "");
    toast.message("AI text copied into the editor — review, then save.");
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="rounded border border-border bg-muted/30 p-2">
        {scanUrl ? (
          <img src={scanUrl} alt="First scan" className="max-h-[75vh] w-full object-contain" />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            No scan attached — upload scans to transcribe side by side.
          </p>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label">Raw AI transcription (read-only)</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={!letter.transcription_raw_ai}
              onClick={copyAiIntoVerified}
            >
              Copy into verified
            </Button>
          </div>
          <div className="max-h-48 overflow-auto rounded border border-archive-ai/40 bg-archive-ai-surface p-3 text-sm whitespace-pre-wrap">
            {letter.transcription_raw_ai || (
              <span className="text-muted-foreground">
                None yet. AI/OCR output will appear here and never overwrites verified text.
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="field-label">Verified transcription</span>
          <Textarea
            rows={16}
            className="mt-1.5 font-mono text-sm"
            value={verified}
            onChange={(e) => setVerified(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
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
          <Button onClick={save}>Save transcription</Button>
        </div>
      </div>
    </div>
  );
}
