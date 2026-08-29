import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileWarning,
  GripVertical,
  ImageIcon,
  Layers,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaLightbox, type LightboxItem } from "@/components/ui/media-lightbox";
import { canDerive, makeDerivatives } from "@/lib/derivatives";
import {
  DIGITIZATION_STATUS,
  MASTER_ACCEPT,
  digitizationHint,
  expectedScans,
  formatSeq,
  normalizeFh,
  parseScanFilename,
  suggestedLabels,
  usesPhotoSides,
} from "@/lib/digitization";
import {
  deleteDigitalFile,
  fetchDigitalFiles,
  signedScanUrl,
  type DigitalFileWithDerivatives,
} from "@/lib/digital-files";
import { labelOf } from "@/lib/archive";
import type { Letter } from "@/lib/queries";

type Progress = { total: number; done: number; current: string; stage: string } | null;

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <div className="rounded border border-border bg-card px-3 py-2">
      <div className="field-label">{label}</div>
      <div
        className={`mt-0.5 text-sm font-medium ${
          tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function DigitizationPanel({ letter }: { letter: Letter }) {
  const qc = useQueryClient();
  const key = ["digital-files", letter.id];
  const [progress, setProgress] = useState<Progress>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const { data: files = [] } = useQuery({
    queryKey: key,
    queryFn: () => fetchDigitalFiles(letter.id),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const refreshLetter = () => {
    qc.invalidateQueries({ queryKey: ["letter", letter.archive_id] });
    qc.invalidateQueries({ queryKey: ["letters"] });
  };

  async function patchLetter(patch: Record<string, unknown>) {
    const { error } = await supabase.from("letters").update(patch as never).eq("id", letter.id);
    if (error) return toast.error(error.message);
    refreshLetter();
  }

  const { expected, breakdown, source } = expectedScans({
    record_type: letter.record_type,
    has_envelope: letter.has_envelope,
    sheets: letter.sheets,
    scan_both_sides: letter.scan_both_sides ?? true,
    completeness_check: letter.completeness_check ?? false,
    expected_scan_count: letter.expected_scan_count ?? null,
  });

  const masters = files.length;
  const jpegCount = files.filter((f) =>
    f.derivatives.some((d) => d.kind === "jpeg" && d.status === "complete"),
  ).length;
  const thumbCount = files.filter((f) =>
    f.derivatives.some((d) => d.kind === "thumbnail" && d.status === "complete"),
  ).length;
  const failedDerivatives = files.filter((f) =>
    f.derivatives.some((d) => d.status === "failed"),
  );
  const mismatched = files.filter((f) => !f.filename_matches);
  const isLetterType = (letter.record_type ?? "letter") === "letter";
  const labels = suggestedLabels(letter.record_type);

  /* ------------------------------- upload ------------------------------- */

  async function uploadFiles(list: FileList | File[]) {
    const chosen = Array.from(list);
    if (!chosen.length) return;
    const startOrder = files.length;
    let added = 0;

    for (let i = 0; i < chosen.length; i++) {
      const file = chosen[i];
      const step = (stage: string) =>
        setProgress({ total: chosen.length, done: i, current: file.name, stage });

      step("Storing archival master…");
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const masterPath = `${letter.archive_id}/masters/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("scans")
        .upload(masterPath, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) {
        toast.error(`${file.name}: master not stored — ${upErr.message}`);
        continue;
      }

      const parsed = parseScanFilename(file.name);
      const matches = parsed.fh === null ? true : parsed.fh === normalizeFh(letter.archive_id);

      const { data: inserted, error: insErr } = await supabase
        .from("digital_files")
        .insert({
          letter_id: letter.id,
          seq: parsed.seq,
          sort_order: parsed.seq ?? startOrder + i + 1,
          original_filename: file.name,
          master_path: masterPath,
          master_mime: file.type || null,
          master_size: file.size,
          filename_matches: matches,
        } as never)
        .select("id")
        .single();
      if (insErr || !inserted) {
        toast.error(`${file.name}: ${insErr?.message ?? "could not be recorded"}`);
        continue;
      }
      added++;
      const fileId = (inserted as { id: string }).id;

      if (!canDerive(file)) continue;

      step("Generating JPEG + thumbnail…");
      try {
        const derived = await makeDerivatives(file);
        const base = `${letter.archive_id}/derivatives/${fileId}`;
        const viewPath = `${base}_view.jpg`;
        const thumbPath = `${base}_thumb.jpg`;
        const [v, t] = await Promise.all([
          supabase.storage
            .from("scans")
            .upload(viewPath, derived.view.blob, { upsert: true, contentType: "image/jpeg" }),
          supabase.storage
            .from("scans")
            .upload(thumbPath, derived.thumb.blob, { upsert: true, contentType: "image/jpeg" }),
        ]);
        if (v.error || t.error) throw new Error(v.error?.message ?? t.error?.message);
        await supabase.from("file_derivatives").insert([
          {
            letter_id: letter.id,
            file_id: fileId,
            kind: "jpeg",
            status: "complete",
            storage_path: viewPath,
            mime_type: "image/jpeg",
            file_size: derived.view.blob.size,
            width: derived.view.width,
            height: derived.view.height,
          },
          {
            letter_id: letter.id,
            file_id: fileId,
            kind: "thumbnail",
            status: "complete",
            storage_path: thumbPath,
            mime_type: "image/jpeg",
            file_size: derived.thumb.blob.size,
            width: derived.thumb.width,
            height: derived.thumb.height,
          },
        ] as never);
      } catch (err) {
        await supabase.from("file_derivatives").insert({
          letter_id: letter.id,
          file_id: fileId,
          kind: "jpeg",
          status: "failed",
          error: (err as Error).message,
        } as never);
        toast.warning(
          `${file.name}: master stored safely, but the JPEG derivative could not be generated.`,
        );
      }
    }

    setProgress(null);
    refresh();
    if (added) {
      if ((letter.digitization_status ?? "not_scanned") === "not_scanned")
        await patchLetter({ digitization_status: "in_progress" });
      toast.success(`${added} archival master${added === 1 ? "" : "s"} stored unmodified.`);
    }
  }

  /* -------------------------------- edits -------------------------------- */

  async function patchFile(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("digital_files").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function reorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const list = [...files];
    const from = list.findIndex((f) => f.id === dragId);
    const to = list.findIndex((f) => f.id === targetId);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setDragId(null);
    await Promise.all(
      list.map((f, i) =>
        supabase.from("digital_files").update({ sort_order: i + 1 } as never).eq("id", f.id),
      ),
    );
    refresh();
  }

  async function remove(file: DigitalFileWithDerivatives) {
    if (
      !confirm(
        `Permanently delete the archival master ${file.original_filename} and its derivatives? This cannot be undone.`,
      )
    )
      return;
    try {
      await deleteDigitalFile(file);
      refresh();
      toast.success("Master and derivatives deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function downloadMaster(file: DigitalFileWithDerivatives) {
    const url = await signedScanUrl(file.master_path, 120);
    if (!url) return toast.error("Could not create a download link");
    const a = document.createElement("a");
    a.href = url;
    a.download = file.original_filename;
    a.target = "_blank";
    a.click();
  }

  const lightboxItems: LightboxItem[] = useMemo(
    () =>
      files
        .filter((f) => f.viewUrl)
        .map((f) => ({
          id: f.id,
          url: f.viewUrl,
          type: "image" as const,
          title: `${formatSeq(f.seq)} — ${f.label || f.original_filename}`,
          subtitle: `${letter.archive_id} · viewing derivative`,
          filename: f.original_filename,
          rotation: f.rotation,
        })),
    [files, letter.archive_id],
  );
  const viewerFile = files.filter((f) => f.viewUrl)[viewerIndex];

  /* ------------------------------- render -------------------------------- */

  const status = letter.digitization_status ?? "not_scanned";
  const complete = status === "complete";

  return (
    <section className="space-y-6">
      {/* Summary */}
      <div className="rounded border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="field-label flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Digitization
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) =>
                patchLetter({
                  digitization_status: e.target.value,
                  digitization_completed_at:
                    e.target.value === "complete" ? new Date().toISOString() : null,
                })
              }
              className="h-8 rounded border border-input bg-background px-2 text-sm"
            >
              {DIGITIZATION_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {!complete && (
              <Button
                size="sm"
                onClick={() =>
                  patchLetter({
                    digitization_status: "complete",
                    digitization_override: expected !== null && masters !== expected,
                    digitization_completed_at: new Date().toISOString(),
                  })
                }
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Mark Digitization Complete
                {expected !== null && masters !== expected ? " Anyway" : ""}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label="Status"
            value={labelOf(DIGITIZATION_STATUS, status)}
            tone={complete ? "good" : status === "not_scanned" ? "warn" : "default"}
          />
          <Stat label="Archival masters" value={String(masters)} />
          <Stat label="Expected" value={expected === null ? "Not set" : String(expected)} />
          <Stat
            label="Viewing derivatives"
            value={`${jpegCount} of ${masters}`}
            tone={masters > 0 && jpegCount === masters ? "good" : masters ? "warn" : "default"}
          />
          <Stat label="Thumbnails" value={`${thumbCount} of ${masters}`} />
        </div>

        {expected !== null && (
          <p
            className={`mt-3 text-sm ${
              masters >= expected ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {masters >= expected ? (
              <>
                <CheckCircle2 className="mr-1.5 inline size-4" />
                Master scans: {masters} of {expected} ✓
              </>
            ) : (
              <>
                <AlertTriangle className="mr-1.5 inline size-4" />
                Expected scans: {expected} · Master scans uploaded: {masters} —{" "}
                {expected - masters} scan{expected - masters === 1 ? "" : "s"} may be missing. This
                is advisory only; you can still mark the record complete.
              </>
            )}
          </p>
        )}
        {letter.digitization_override && complete && (
          <p className="mt-1 text-xs text-muted-foreground">
            Marked complete manually, overriding the calculated expectation.
          </p>
        )}
        {failedDerivatives.length > 0 && (
          <p className="mt-2 text-sm text-amber-700">
            <FileWarning className="mr-1.5 inline size-4" />
            {failedDerivatives.length} master{failedDerivatives.length === 1 ? " is" : "s are"}{" "}
            safely stored but the JPEG derivative needs attention — use “Regenerate” on the file.
          </p>
        )}
        {mismatched.length > 0 && (
          <p className="mt-2 text-sm text-destructive">
            <AlertTriangle className="mr-1.5 inline size-4" />
            {mismatched.length} filename{mismatched.length === 1 ? " does" : "s do"} not begin with{" "}
            {letter.archive_id} — check for misfiling.
          </p>
        )}
      </div>

      {/* Record-type helper */}
      <div className="rounded border border-border p-4">
        <h4 className="field-label mb-2 flex items-center gap-2">
          <Layers className="size-4" /> Completeness helper
        </h4>
        <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
          {digitizationHint(letter.record_type)}
        </p>

        {isLetterType ? (
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={letter.completeness_check ?? false}
                onChange={(e) => patchLetter({ completeness_check: e.target.checked })}
              />
              Completeness checking
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={letter.has_envelope}
                onChange={(e) => patchLetter({ has_envelope: e.target.checked })}
              />
              Envelope present
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={letter.scan_both_sides ?? true}
                onChange={(e) => patchLetter({ scan_both_sides: e.target.checked })}
              />
              Scanning both sides
            </label>
            <div>
              <label className="field-label">Physical sheets</label>
              <Input
                type="number"
                min={0}
                className="w-28"
                defaultValue={letter.sheets ?? ""}
                onBlur={(e) =>
                  patchLetter({ sheets: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div>
              <label className="field-label">Override expected count</label>
              <Input
                type="number"
                min={0}
                className="w-36"
                placeholder="optional"
                defaultValue={letter.expected_scan_count ?? ""}
                onBlur={(e) =>
                  patchLetter({
                    expected_scan_count: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            {usesPhotoSides(letter.record_type) && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={letter.photo_front_scanned ?? false}
                    onChange={(e) => patchLetter({ photo_front_scanned: e.target.checked })}
                  />
                  Front scanned
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={letter.photo_back_scanned ?? false}
                    onChange={(e) => patchLetter({ photo_back_scanned: e.target.checked })}
                  />
                  Back scanned
                </label>
              </>
            )}
            <div>
              <label className="field-label">Expected images (optional)</label>
              <Input
                type="number"
                min={0}
                className="w-40"
                placeholder="not required"
                defaultValue={letter.expected_scan_count ?? ""}
                onBlur={(e) =>
                  patchLetter({
                    expected_scan_count: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
        )}

        {source === "calculated" && breakdown.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Suggested sequence: {breakdown.join(" · ")}
          </p>
        )}
      </div>

      {/* Uploader */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        className="rounded border-2 border-dashed border-border bg-muted/40 px-6 py-8 text-center"
      >
        <UploadCloud className="mx-auto mb-2 size-7 text-primary" />
        <p className="text-sm">
          <label className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline">
            Upload Scans / Digital Files
            <input
              type="file"
              multiple
              accept={MASTER_ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </label>{" "}
          — or drop a whole batch here (e.g. {letter.archive_id}_001.tif …_010.tif)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The TIFF you upload is stored byte-for-byte as the archival master and is never resized,
          recompressed or replaced. JPEG viewing copies and thumbnails are generated automatically
          from it.
        </p>
        {progress && (
          <div className="mx-auto mt-4 max-w-md text-left">
            <div className="flex justify-between text-xs">
              <span className="truncate">{progress.current}</span>
              <span className="tabular-nums">
                {progress.done + 1} / {progress.total}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-border">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${((progress.done + 0.5) / progress.total) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{progress.stage}</p>
          </div>
        )}
      </div>

      {/* Gallery */}
      <div>
        <h4 className="field-label mb-3">Scan gallery — {masters} master files</h4>
        {masters === 0 ? (
          <p className="text-sm text-muted-foreground">
            No archival masters uploaded for {letter.archive_id} yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {files.map((f, i) => {
              const jpegOk = f.derivatives.some(
                (d) => d.kind === "jpeg" && d.status === "complete",
              );
              const derivFailed = f.derivatives.some((d) => d.status === "failed");
              return (
                <div
                  key={f.id}
                  draggable
                  onDragStart={() => setDragId(f.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    reorder(f.id);
                  }}
                  className="rounded border border-border bg-card p-2"
                >
                  <div className="mb-1 flex items-center gap-1">
                    <GripVertical className="size-3.5 cursor-grab text-muted-foreground" />
                    <span className="archive-id text-xs font-semibold text-primary">
                      {formatSeq(f.seq ?? f.sort_order)}
                    </span>
                    {!f.filename_matches && (
                      <span title="Filename does not match this FH number">
                        <AlertTriangle className="size-3.5 text-destructive" />
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const idx = files.filter((x) => x.viewUrl).findIndex((x) => x.id === f.id);
                      if (idx < 0) return;
                      setViewerIndex(idx);
                      setViewerOpen(true);
                    }}
                    className="block h-36 w-full overflow-hidden rounded bg-muted"
                  >
                    {f.thumbUrl ? (
                      <img
                        src={f.thumbUrl}
                        alt={f.label || f.original_filename}
                        style={{ transform: `rotate(${f.rotation}deg)` }}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        <ImageIcon className="mr-1 size-4" /> No preview
                      </span>
                    )}
                  </button>

                  <p className="mt-1 truncate text-[11px] text-muted-foreground" title={f.original_filename}>
                    {f.original_filename}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    <span className="rounded bg-secondary px-1 py-0.5 font-medium">MASTER</span>
                    {jpegOk && <span className="rounded bg-secondary px-1 py-0.5">JPEG</span>}
                    {derivFailed && (
                      <span className="rounded bg-destructive/10 px-1 py-0.5 text-destructive">
                        derivative failed
                      </span>
                    )}
                  </div>

                  <Input
                    list={`labels-${letter.id}`}
                    className="mt-1.5 h-7 text-xs"
                    placeholder="Label (optional)"
                    defaultValue={f.label ?? ""}
                    onBlur={(e) => {
                      if ((f.label ?? "") !== e.target.value)
                        patchFile(f.id, { label: e.target.value || null });
                    }}
                  />

                  <div className="mt-1 flex items-center justify-between">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Download original TIFF master"
                      onClick={() => downloadMaster(f)}
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1.5 text-[11px]"
                      title="Transcribe this scan with ChatGPT (the master is never altered)"
                      disabled={transcribing.includes(f.id)}
                      onClick={() => transcribeOne(f.id)}
                    >
                      {transcribing.includes(f.id) ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 size-3.5" />
                      )}
                      Transcribe
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive"
                      onClick={() => remove(f)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <span className="sr-only">{i}</span>
                </div>
              );
            })}
          </div>
        )}
        <datalist id={`labels-${letter.id}`}>
          {labels.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      <MediaLightbox
        items={lightboxItems}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        onRotationChange={(id, rotation) => patchFile(id, { rotation })}
        footerAction={
          viewerFile
            ? {
                label: "Download original TIFF master",
                onClick: () => downloadMaster(viewerFile),
              }
            : undefined
        }
      />
    </section>
  );
}
