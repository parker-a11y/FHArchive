// Names for files placed inside a scan ZIP. Everything is written flat — no
// folders — so the record number has to live in the file name itself.

/** Strip anything that would create a folder or break a file system. */
function safeBase(filename: string): string {
  const base = filename.split(/[\\/]/).filter(Boolean).pop() ?? "scan";
  return base
    .replace(/[\u0000-\u001f<>:"|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "scan";
}

/**
 * Build a unique, folder-free ZIP entry name: "FH0817 - Page 1 Front.tif".
 * Duplicates gain " (2)", " (3)" … before the extension. The caller's `taken`
 * set is not mutated, so it can be reused across a whole batch.
 */
export function flatScanName(recordId: string, filename: string, taken: Set<string>): string {
  const base = safeBase(filename);
  const ext = /\.[A-Za-z0-9]{1,5}$/.exec(base)?.[0] ?? "";
  const stem = ext ? base.slice(0, -ext.length) : base;
  const id = safeBase(recordId || "record");
  let name = `${id} - ${base}`;
  for (let n = 2; taken.has(name); n++) name = `${id} - ${stem} (${n})${ext}`;
  return name;
}
