import { supabase } from "@/integrations/supabase/client";

export type FileDerivative = {
  id: string;
  letter_id: string;
  file_id: string | null;
  kind: string;
  status: string;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  text_content: string | null;
  error: string | null;
  created_at: string;
};

export type DigitalFile = {
  id: string;
  letter_id: string;
  seq: number | null;
  sort_order: number;
  original_filename: string;
  master_path: string;
  master_mime: string | null;
  master_size: number | null;
  label: string | null;
  filename_matches: boolean;
  rotation: number;
  notes: string | null;
  created_at: string;
};

export type DigitalFileWithDerivatives = DigitalFile & {
  derivatives: FileDerivative[];
  viewUrl: string;
  thumbUrl: string;
  /** True for PDF masters — stored as-is, with each page rendered to a JPEG. */
  isPdf: boolean;
  /** Signed URL to the PDF master itself (empty for non-PDF files). */
  pdfUrl: string;
  /** Signed viewing URLs, one per rendered page (single entry for a scan). */
  pageUrls: string[];
};

export function isPdfMaster(f: { master_mime: string | null; master_path: string }) {
  return /pdf/i.test(f.master_mime ?? "") || /\.pdf$/i.test(f.master_path);
}

const BUCKET = "scans";

export async function signedScanUrl(path: string, expires = 3600) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expires);
  return data?.signedUrl ?? "";
}

export async function fetchDigitalFiles(letterId: string): Promise<DigitalFileWithDerivatives[]> {
  const [filesRes, derRes] = await Promise.all([
    supabase
      .from("digital_files")
      .select("*")
      .eq("letter_id", letterId)
      .order("sort_order", { ascending: true }),
    supabase.from("file_derivatives").select("*").eq("letter_id", letterId),
  ]);
  if (filesRes.error) throw filesRes.error;
  if (derRes.error) throw derRes.error;

  const files = (filesRes.data ?? []) as DigitalFile[];
  const derivatives = (derRes.data ?? []) as FileDerivative[];

  return Promise.all(
    files.map(async (f) => {
      const own = derivatives.filter((d) => d.file_id === f.id);
      const byPath = (a: FileDerivative, b: FileDerivative) =>
        (a.storage_path ?? "").localeCompare(b.storage_path ?? "");
      const jpegs = own
        .filter((d) => d.kind === "jpeg" && d.status === "complete" && d.storage_path)
        .sort(byPath);
      const thumb = own
        .filter((d) => d.kind === "thumbnail" && d.status === "complete" && d.storage_path)
        .sort(byPath)[0];
      const browserViewable = /^image\/(jpeg|png|webp|gif)$/i.test(f.master_mime ?? "");
      const viewPath = jpegs[0]?.storage_path ?? (browserViewable ? f.master_path : null);
      const thumbPath = thumb?.storage_path ?? viewPath;
      const pdf = isPdfMaster(f);
      const [viewUrl, thumbUrl, pdfUrl, pageUrls] = await Promise.all([
        viewPath ? signedScanUrl(viewPath) : Promise.resolve(""),
        thumbPath ? signedScanUrl(thumbPath) : Promise.resolve(""),
        pdf ? signedScanUrl(f.master_path) : Promise.resolve(""),
        Promise.all(jpegs.map((d) => signedScanUrl(d.storage_path as string))),
      ]);
      return {
        ...f,
        derivatives: own,
        viewUrl,
        thumbUrl,
        isPdf: pdf,
        pdfUrl,
        pageUrls: pageUrls.filter(Boolean).length ? pageUrls.filter(Boolean) : viewUrl ? [viewUrl] : [],
      };
    }),
  );
}

/** Record-level derivatives (OCR text, combined PDF) not tied to one master. */
export async function fetchRecordDerivatives(letterId: string): Promise<FileDerivative[]> {
  const { data, error } = await supabase
    .from("file_derivatives")
    .select("*")
    .eq("letter_id", letterId)
    .is("file_id", null);
  if (error) throw error;
  return (data ?? []) as FileDerivative[];
}

/** Deletes a master plus every derivative generated from it. */
export async function deleteDigitalFile(file: DigitalFileWithDerivatives) {
  const paths = [
    file.master_path,
    ...file.derivatives.map((d) => d.storage_path).filter(Boolean),
  ] as string[];
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("digital_files").delete().eq("id", file.id);
  if (error) throw error;
}

export async function countMasters(letterId: string) {
  const { count } = await supabase
    .from("digital_files")
    .select("id", { count: "exact", head: true })
    .eq("letter_id", letterId);
  return count ?? 0;
}
