import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileWarning,
  GripVertical,
  ImageIcon,
  Layers,
  Loader2,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaLightbox, type LightboxItem } from "@/components/ui/media-lightbox";
import {
  SCAN_STATUS_LABEL,
  derivativeFailed,
  generateDerivatives,
  hasJpeg,
  hasThumb,
  isNamed,
  pendingFiles,
  recordDerivativeFailure,
  scanStatus,
  unnamedFiles,
} from "@/lib/scan-confirm";
import {
  DIGITIZATION_STATUS,
  MASTER_ACCEPT,
  digitizationHint,
  expectedScans,
  formatSeq,
  normalizeFh,
  parseScanFilename,
  sortByFilename,
  suggestedLabels,
  usesPhotoSides,
} from "@/lib/digitization";
import {
  deleteDigitalFile,
  fetchDigitalFiles,
  signedScanUrl,
  type DigitalFileWithDerivatives,
} from "@/lib/digital-files";

import {
  basenameOf,
  extensionOf,
  nextSuggestedChoice,
  quickIdentifyChoices,
  renameScanFile,
  sanitizeLabel,
} from "@/lib/scan-rename";
import { rotateStoredImage } from "@/lib/rotate";
import { transcribeScans } from "@/lib/transcription.functions";
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
  const { isGuestViewer, isAdmin } = useAuth();
  const key = ["digital-files", letter.id];
  const [progress, setProgress] = useState<Progress>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [transcribing, setTranscribing] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [lastLabel, setLastLabel] = useState<string | null>(null);
  const [generating, setGenerating] = useState<{ done: number; total: number } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);

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

  // Keep the record's scan count in step with the digital files it holds.
  useEffect(() => {
    const status = masters > 0 ? "scanned" : "not_scanned";
    if (letter.image_count === masters && letter.scan_status === status) return;
    supabase
      .from("letters")
      .update({ image_count: masters, scan_status: status } as never)
      .eq("id", letter.id)
      .then(() => refreshLetter());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masters, letter.id, letter.image_count, letter.scan_status]);

  const jpegFiles = files.filter(hasJpeg);
  const thumbFiles = files.filter(hasThumb);
  const jpegCount = jpegFiles.length;
  const thumbCount = thumbFiles.length;
  const unnamed = unnamedFiles(files);
  const pending = pendingFiles(files);
  const scanState = scanStatus(files, { uploading: !!progress, generating: !!generating });
  const failedDerivatives = files.filter((f) =>
    f.derivatives.some((d) => d.status === "failed"),
  );
  const mismatched = files.filter((f) => !f.filename_matches);
  const isLetterType = (letter.record_type ?? "letter") === "letter";
  const labels = suggestedLabels(letter.record_type);
  const quickChoices = quickIdentifyChoices(letter.record_type, letter.subtype);
  const lastIdentified =
    lastLabel ?? [...files].reverse().find((f) => f.label)?.label ?? null;
  const suggestedNext = nextSuggestedChoice(lastIdentified, quickChoices);

  /* ------------------------------- upload ------------------------------- */

  async function uploadFiles(list: FileList | File[]) {
    const chosen = sortByFilename(Array.from(list));
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
      const seq = parsed.seq ?? null;
      const sortOrder = seq ?? startOrder + i + 1;

      const { data: inserted, error: insErr } = await supabase
        .from("digital_files")
        .insert({
          letter_id: letter.id,
          seq,
          sort_order: sortOrder,
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
      // Derivatives are intentionally NOT generated here — they are produced
      // only after "Confirm Upload Complete".
    }

    setProgress(null);
    refresh();
    if (added) {
      if ((letter.digitization_status ?? "not_scanned") === "not_scanned")
        await patchLetter({ digitization_status: "in_progress" });
      toast.success(
        `${added} archival master${added === 1 ? "" : "s"} stored unmodified. Name them, then Confirm Upload Complete.`,
      );
    }
  }

  /* --------------------- confirm upload → derivatives --------------------- */

  function jumpToScan(id: string) {
    setHighlightId(id);
    document.getElementById(`scan-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 2500);
  }

  async function confirmUploadComplete() {
    // Naming is optional: anything left unidentified simply gets its sequence number.
    let current = [...files];
    const renameErrors: string[] = [];
    if (unnamed.length) {
      for (const f of unnamed) {
        try {
          const name = await renameScanFile({
            archiveId: letter.archive_id,
            file: f,
            label: String(f.seq ?? f.sort_order ?? 1).padStart(3, "0"),
            otherFiles: current,
          });
          const newPath = `${letter.archive_id}/masters/${name}`;
          current = current.map((c) =>
            c.id === f.id ? { ...c, master_path: newPath, label: name } : c,
          );
        } catch (err) {
          const msg = (err as Error).message || "unknown error";
          renameErrors.push(`${basenameOf(f.master_path)}: ${msg}`);
        }
      }
      if (renameErrors.length) {
        toast.error(
          `${renameErrors.length} scan${renameErrors.length === 1 ? "" : "s"} could not be renamed — ${renameErrors[0]}`,
          { duration: 12000 },
        );
        renameErrors.forEach((e) => console.error("Rename failed:", e));
      } else {
        toast.info(
          `${unnamed.length} unidentified scan${unnamed.length === 1 ? "" : "s"} numbered sequentially.`,
        );
      }
      refresh();
    }
    const todo = pendingFiles(current);
    if (!todo.length) {
      if (current.length && (letter.digitization_status ?? "not_scanned") !== "complete") {
        await patchLetter({
          digitization_status: "complete",
          digitization_completed_at: new Date().toISOString(),
        });
      }
      if (!renameErrors.length)
        toast.success("Processing complete — nothing left to generate for this record.");
      return;
    }

    setGenerating({ done: 0, total: todo.length });
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      setGenerating({ done: i, total: todo.length });
      try {
        await generateDerivatives(letter.archive_id, letter.id, todo[i]);
        ok++;
      } catch (err) {
        failed++;
        const msg = (err as Error).message || "Unknown error";
        await recordDerivativeFailure(letter.id, todo[i].id, msg);
        toast.error(
          `${basenameOf(todo[i].master_path)}: derivative failed — ${msg}`,
          { duration: 8000 },
        );
      }
    }
    setGenerating(null);
    refresh();
    if (ok && !failed) {
      await patchLetter({
        digitization_status: "complete",
        digitization_completed_at: new Date().toISOString(),
      });
      toast.success(`Processing complete — ${ok} viewing JPEG${ok === 1 ? "" : "s"} and thumbnails generated.`);
    } else if (ok) {
      toast.warning(`${ok} processed, ${failed} failed. Masters are all safe.`);
    }
  }


  /* ----------------------------- transcription ---------------------------- */

  async function transcribeOne(fileId: string) {
    setTranscribing((t) => [...t, fileId]);
    try {
      const [result] = await transcribeScans({ data: { fileIds: [fileId] } });
      if (result?.ok) toast.success("Scan transcribed — review it in the Transcription tab.");
      else toast.error(result?.error ?? "Transcription failed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranscribing((t) => t.filter((id) => id !== fileId));
      qc.invalidateQueries({ queryKey: ["scan-transcriptions", letter.id] });
    }
  }

  /* -------------------------------- edits -------------------------------- */

  async function patchFile(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("digital_files").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  /* --------------------- fast identification / renaming -------------------- */

  async function identify(file: DigitalFileWithDerivatives, label: string) {
    setRenamingId(file.id);
    try {
      const name = await renameScanFile({
        archiveId: letter.archive_id,
        file,
        label,
        otherFiles: files,
      });
      setLastLabel(label);
      refresh();
      toast.success(`Renamed to ${name}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRenamingId(null);
    }
  }

  function identifyCustom(file: DigitalFileWithDerivatives) {
    const raw = window.prompt("Describe this scan (e.g. Christmas Card, Newspaper Clipping)");
    if (!raw) return;
    const clean = sanitizeLabel(raw);
    if (!clean) return toast.error("That description could not be used as a filename.");
    identify(file, clean.replace(/-/g, " "));
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

  /** Rotates the viewing JPG + thumbnail 90° clockwise. The master is untouched. */
  async function rotate(file: DigitalFileWithDerivatives) {
    const targets = file.derivatives.filter(
      (d) => (d.kind === "jpeg" || d.kind === "thumbnail") && d.status === "complete" && d.storage_path,
    );
    setRotatingId(file.id);
    try {
      if (!targets.length) {
        const next = (((file.rotation ?? 0) + 90) % 360 + 360) % 360;
        const { error } = await supabase
          .from("digital_files")
          .update({ rotation: next } as never)
          .eq("id", file.id);
        if (error) throw error;
        toast.success("Rotated — will be baked in when derivatives are generated");
      } else {
        for (const d of targets) {
          const r = await rotateStoredImage("scans", d.storage_path as string, 90);
          await supabase
            .from("file_derivatives")
            .update({ width: r.width, height: r.height, file_size: r.size } as never)
            .eq("id", d.id);
        }
        await supabase.from("digital_files").update({ rotation: 0 } as never).eq("id", file.id);
        toast.success("Rotated 90° — viewing JPG and thumbnail updated");
      }
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRotatingId(null);
    }
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
            label="Processing status"
            value={SCAN_STATUS_LABEL[scanState]}
            tone={
              scanState === "complete"
                ? "good"
                : scanState === "error" || scanState === "needs_naming"
                  ? "warn"
                  : "default"
            }
          />
          <Stat label="Archival masters" value={String(masters)} />
          <Stat label="Expected" value={expected === null ? "Not set" : String(expected)} />
          <Stat
            label="Viewing JPGs"
            value={`${jpegCount} of ${masters}`}
            tone={masters > 0 && jpegCount === masters ? "good" : masters ? "warn" : "default"}
          />
          <Stat label="Thumbnails" value={`${thumbCount} of ${masters}`} />
        </div>

        {/* Confirm upload complete → derivative generation (admin action) */}
        {masters > 0 && !isGuestViewer && (
          <div className="mt-3 rounded border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                {generating ? (
                  <span className="flex items-center gap-2 text-primary">
                    <Loader2 className="size-4 animate-spin" />
                    Generating derivatives — {generating.done + 1} of {generating.total}
                  </span>
                ) : unnamed.length ? (
                  <span className="text-muted-foreground">
                    {unnamed.length} scan{unnamed.length === 1 ? "" : "s"} not identified — they
                    will be numbered sequentially on confirm.{" "}
                    <button
                      className="font-medium underline underline-offset-2"
                      onClick={() => jumpToScan(unnamed[0].id)}
                    >
                      Go to that scan
                    </button>
                  </span>
                ) : pending.length ? (
                  <span>
                    {pending.length} master{pending.length === 1 ? "" : "s"} ready for derivative
                    generation. Masters are never altered.
                  </span>
                ) : (
                  <span className="text-emerald-700">
                    <CheckCircle2 className="mr-1.5 inline size-4" />
                    {masters} Master TIFF{masters === 1 ? "" : "s"} · {jpegCount} Viewing JPG
                    {jpegCount === 1 ? "" : "s"} · {thumbCount} Thumbnail
                    {thumbCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <Button
                onClick={confirmUploadComplete}
                disabled={!!generating || !!progress || pending.length === 0}
              >
                <ShieldCheck className="mr-1.5 size-4" />
                Confirm Upload Complete
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Confirming is not a lock — you can add, replace or rename scans later and confirm
              again. Only new or changed masters are processed.
            </p>
          </div>
        )}


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
            safely stored but the JPEG derivative needs attention — click “Confirm Upload Complete”
            to retry.
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
      <fieldset disabled={isGuestViewer} className="contents">
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
      </fieldset>

      {/* Uploader — admins only */}
      {isAdmin && (
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        className={`rounded border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragActive
            ? "border-primary bg-primary/10"
            : "border-border bg-muted/40"
        }`}
      >
        <UploadCloud className="mx-auto mb-3 size-8 text-primary" />
        <p className="text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
            <UploadCloud className="size-4" />
            Upload Scans / Digital Files
            <input
              type="file"
              multiple
              accept={MASTER_ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </label>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Or drop a whole batch here (e.g. {letter.archive_id}_001.tif …_010.tif)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dropped batches are automatically sorted by filename so pages import in order. The TIFF you
          upload is stored byte-for-byte as the archival master and is never resized, recompressed
          or replaced. Name each scan, then click “Confirm Upload Complete” to generate the JPEG
          viewing copies and thumbnails.
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
      )}

      {/* Gallery */}
      <div>
        <h4 className="field-label mb-1">Original TIFFs — {masters} archival masters</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Preservation files. Identify each scan here, then confirm the upload to produce the
          viewing and thumbnail sets below.
        </p>
        {masters === 0 ? (
          <p className="text-sm text-muted-foreground">
            No archival masters uploaded for {letter.archive_id} yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {files.map((f, i) => {
              const jpegOk = hasJpeg(f);
              const derivFailed = derivativeFailed(f);
              return (
                <div
                  key={f.id}
                  id={`scan-${f.id}`}
                  draggable={!isGuestViewer}
                  onDragStart={() => setDragId(f.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    reorder(f.id);
                  }}
                  className={`rounded border bg-card p-2 ${
                    highlightId === f.id
                      ? "border-amber-500 ring-2 ring-amber-400"
                      : "border-border"
                  }`}
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

                  <p
                    className="mt-1 truncate text-[11px] font-medium"
                    title={`Archival filename · original scanner name: ${f.original_filename}`}
                  >
                    {basenameOf(f.master_path)}.{extensionOf(f.master_path)}
                  </p>
                  <p
                    className="truncate text-[10px] text-muted-foreground"
                    title={f.original_filename}
                  >
                    from {f.original_filename}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    <span className="rounded bg-secondary px-1 py-0.5 font-medium">MASTER</span>
                    {jpegOk && <span className="rounded bg-secondary px-1 py-0.5">JPEG</span>}
                    {hasThumb(f) && <span className="rounded bg-secondary px-1 py-0.5">THUMB</span>}
                    {!isNamed(f) && (
                      <span className="rounded bg-secondary px-1 py-0.5 text-muted-foreground">
                        unidentified — will be numbered
                      </span>
                    )}
                    {derivFailed && (
                      <span className="rounded bg-destructive/10 px-1 py-0.5 text-destructive">
                        derivative failed
                      </span>
                    )}
                  </div>

                  {/* One-click identification — renames master + derivatives (admin) */}
                  {!isGuestViewer && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {renamingId === f.id ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Renaming…
                      </span>
                    ) : (
                      <>
                        {quickChoices.map((c) => {
                          const isCurrent = f.label === c;
                          const isNext = !f.label && c === suggestedNext;
                          return (
                            <button
                              key={c}
                              onClick={() => identify(f, c)}
                              className={`rounded border px-1.5 py-0.5 text-[10px] leading-tight transition ${
                                isCurrent
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : isNext
                                    ? "border-primary bg-primary/10 font-medium text-primary"
                                    : "border-border bg-background hover:bg-secondary"
                              }`}
                              title={
                                isNext ? "Suggested next — click to confirm" : `Rename to ${c}`
                              }
                            >
                              {c}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => identifyCustom(f)}
                          className="rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] hover:bg-secondary"
                        >
                          + Custom
                        </button>
                       </>
                     )}
                   </div>
                  )}

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
                    {!isGuestViewer && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Rotate 90° clockwise (updates the viewing JPG and thumbnail)"
                          disabled={rotatingId === f.id}
                          onClick={() => rotate(f)}
                        >
                          {rotatingId === f.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="size-3.5" />
                          )}
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
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-1.5 text-[11px] text-destructive hover:text-destructive"
                            title="Permanently delete this scan (master + derivatives)"
                            onClick={() => remove(f)}
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            Delete
                          </Button>
                        )}

                      </>
                    )}
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

      {/* Viewing JPGs */}
      <div>
        <h4 className="field-label mb-1">Viewing JPGs — {jpegCount} files</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Lower-resolution reading copies used everywhere in the archive so the full TIFF never
          has to load.
        </p>
        {jpegCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet — confirm the upload to generate them.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {jpegFiles.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  const idx = files.filter((x) => x.viewUrl).findIndex((x) => x.id === f.id);
                  if (idx < 0) return;
                  setViewerIndex(idx);
                  setViewerOpen(true);
                }}
                className="rounded border border-border bg-card p-1.5 text-left"
              >
                <img
                  src={f.viewUrl}
                  alt={f.label || f.original_filename}
                  loading="lazy"
                  style={{ transform: `rotate(${f.rotation}deg)` }}
                  className="h-24 w-full rounded bg-muted object-contain"
                />
                <p className="mt-1 truncate text-[10px]">{basenameOf(f.master_path)}.jpg</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div>
        <h4 className="field-label mb-1">Thumbnails — {thumbCount} files</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Small browsing images used in galleries and lists.
        </p>
        {thumbCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet — confirm the upload to generate them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {thumbFiles.map((f) => (
              <div key={f.id} className="w-24">
                <img
                  src={f.thumbUrl}
                  alt={f.label || f.original_filename}
                  loading="lazy"
                  style={{ transform: `rotate(${f.rotation}deg)` }}
                  className="h-16 w-24 rounded border border-border bg-muted object-contain"
                />
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {basenameOf(f.master_path)}_thumb.jpg
                </p>
              </div>
            ))}
          </div>
        )}
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
