/**
 * Browser-side file delivery for files the app holds as Blobs (private storage
 * files fetched to memory, generated PDFs, exports).
 *
 * The download must be triggered straight from the click handler: browsers drop
 * user activation after a long `await`, and Safari drops it fastest. So callers
 * prepare the Blob first and then call `deliverFile` on click.
 */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later: iOS Safari can cancel a download whose URL dies immediately.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Hand a file to the visitor. On touch devices the share sheet is offered first
 * (it gives "Save to Files", which blob downloads do not); everything else
 * falls back to a normal download.
 */
export async function deliverFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
    }
  }
  downloadBlob(blob, filename);
}
