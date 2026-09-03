/**
 * Fast post-upload scan identification.
 *
 * One click assigns a descriptive archival filename built from the FH number,
 * e.g. FH0002-Envelope-Front.tif. The scanner's original filename is kept in
 * `digital_files.original_filename` as provenance, and `sort_order` / `seq`
 * keep the original scan sequence regardless of the new name. Derivatives are
 * moved alongside the master so JPEG/thumbnail names stay in step, and no row
 * ids change, so OCR, transcriptions and links are untouched.
 */

import { supabase } from "@/integrations/supabase/client";
import type { DigitalFileWithDerivatives } from "@/lib/digital-files";

const BUCKET = "scans";

/** Record-type aware one-click choices. Always ends with a custom escape hatch. */
export function quickIdentifyChoices(
  recordType: string | null | undefined,
  subtype?: string | null,
): string[] {
  const type = recordType ?? "letter";
  if (type === "letter") {
    if (subtype === "postcard") return ["Front", "Back", "Enclosure", "Other"];
    if (subtype === "telegram")
      return ["Front", "Back", "Envelope Front", "Envelope Back", "Other"];
    return [
      "Page 1 Front",
      "Page 1 Back",
      "Page 2 Front",
      "Page 2 Back",
      "Page 3 Front",
      "Page 3 Back",
      "Enclosure",
      "Envelope Front",
      "Envelope Back",
      "Other",
    ];
  }
  switch (type) {
    case "photograph":
      return ["Front", "Back", "Mount", "Inscription", "Detail", "Other"];
    case "newspaper":
      return ["Clipping", "Full Page", "Reverse", "Masthead", "Other"];
    case "military":
    case "government":
    case "employment":
    case "education":
    case "financial":
      return ["Page 1", "Page 2", "Page 3", "Reverse", "Attachment", "Envelope", "Other"];
    case "program":
      return ["Cover", "Inside Left", "Inside Right", "Back Cover", "Insert", "Other"];
    case "artifact":
    case "medal":
    case "insignia":
      return ["Front View", "Reverse View", "Side View", "Detail", "Makers Mark", "Other"];
    default:
      return ["Front", "Back", "Page 1", "Page 2", "Detail", "Other"];
  }
}

/**
 * Suggests the logical next choice after `current` — never applied
 * automatically, only highlighted so the next click is obvious.
 */
export function nextSuggestedChoice(current: string | null, choices: string[]): string | null {
  if (!current) return choices[0] ?? null;
  const back = current.match(/^(.*)\bFront$/);
  if (back) {
    const candidate = `${back[1]}Back`;
    if (choices.includes(candidate)) return candidate;
  }
  const page = current.match(/^Page (\d+) (Front|Back)$/);
  if (page) {
    const candidate =
      page[2] === "Front" ? `Page ${page[1]} Back` : `Page ${Number(page[1]) + 1} Front`;
    if (choices.includes(candidate)) return candidate;
  }
  
  const i = choices.indexOf(current);
  return i >= 0 && i + 1 < choices.length ? choices[i + 1] : null;
}

/** "Christmas card!!" → "Christmas-Card" — filesystem safe, hyphen separated. */
export function sanitizeLabel(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-")
    .slice(0, 80);
}

export function extensionOf(path: string) {
  const m = path.match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : "bin";
}

export function basenameOf(path: string) {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.[^.]+$/, "");
}

/** FH0002-Enclosure, then -02, -03 … when the base name is already taken. */
export function uniqueBaseName(archiveId: string, label: string, taken: Set<string>) {
  const stem = `${archiveId}-${sanitizeLabel(label)}`;
  if (!taken.has(stem.toLowerCase())) return stem;
  for (let n = 2; n < 500; n++) {
    const candidate = `${stem}-${String(n).padStart(2, "0")}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${stem}-${Date.now()}`;
}

/**
 * Renames the master and every derivative in storage, then points the existing
 * rows at the new paths. Row ids are never recreated, so transcriptions,
 * derivatives and share links keep working.
 */
export async function renameScanFile(opts: {
  archiveId: string;
  file: DigitalFileWithDerivatives;
  label: string;
  otherFiles: DigitalFileWithDerivatives[];
}) {
  const { archiveId, file, label, otherFiles } = opts;
  const taken = new Set(
    otherFiles.filter((f) => f.id !== file.id).map((f) => basenameOf(f.master_path).toLowerCase()),
  );

  // Also treat anything already sitting in the masters folder as taken, so a
  // partially-completed earlier rename can't collide with this one.
  const { data: existing } = await supabase.storage.from(BUCKET).list(`${archiveId}/masters`, {
    limit: 1000,
  });
  const selfFile = (file.master_path.split("/").pop() ?? "").toLowerCase();
  for (const obj of existing ?? []) {
    const nm = obj.name.toLowerCase();
    if (nm !== selfFile) taken.add(basenameOf(nm));
  }

  const base = uniqueBaseName(archiveId, label, taken);
  const ext = extensionOf(file.master_path);
  const newMaster = `${archiveId}/masters/${base}.${ext}`;

  if (newMaster !== file.master_path) {
    const present = (existing ?? []).some((o) => o.name.toLowerCase() === selfName);
    if (!present) {
      throw new Error(
        `Master not found in storage at "${file.master_path}". It may have failed to upload or been deleted.`,
      );
    }
    const { error } = await supabase.storage.from(BUCKET).move(file.master_path, newMaster);
    if (error) throw new Error(`Master could not be renamed: ${error.message}`);
  }


  const derivativeUpdates: { id: string; storage_path: string }[] = [];
  for (const d of file.derivatives) {
    if (!d.storage_path || d.status !== "complete") continue;
    const suffix = d.kind === "thumbnail" ? "_thumb.jpg" : d.kind === "jpeg" ? ".jpg" : null;
    if (!suffix) continue;
    const target = `${archiveId}/derivatives/${base}${suffix}`;
    if (target === d.storage_path) continue;
    const { error } = await supabase.storage.from(BUCKET).move(d.storage_path, target);
    if (error) continue; // master rename already succeeded; keep the old derivative path
    derivativeUpdates.push({ id: d.id, storage_path: target });
  }

  const { error: fileErr } = await supabase
    .from("digital_files")
    .update({ master_path: newMaster, label, filename_matches: true } as never)
    .eq("id", file.id);
  if (fileErr) throw fileErr;

  await Promise.all(
    derivativeUpdates.map((u) =>
      supabase.from("file_derivatives").update({ storage_path: u.storage_path } as never).eq("id", u.id),
    ),
  );

  return `${base}.${ext}`;
}
