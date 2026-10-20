// Server-only backup engine: dumps the whole database to a compressed JSON file,
// rotates old database dumps on a grandfather-father-son schedule, and mirrors every
// storage file (scans + digital source uploads) to Google Drive incrementally.

import { retryBackupRead } from "./backup-retry";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

const ROOT_FOLDER = "The Francis Files Backups";
const FILES_FOLDER = "files";
const BUCKETS = ["scans", "ds-files"] as const;

// Every table that must be recreatable from a backup.
const TABLES = [
  "letters",
  "letter_people",
  "letter_places",
  "letter_keywords",
  "letter_organizations",
  "letter_events",
  "letter_relations",
  "letter_sources",
  "people",
  "places",
  "keywords",
  "organizations",
  "events",
  "historical_references",
  "ai_suggestions",
  "edit_history",
  "archive_counter",
  "digital_sources",
  "ds_files",
  "ds_segments",
  "ds_people",
  "ds_places",
  "ds_keywords",
  "ds_organizations",
  "ds_events",
  "ds_counter",
  "backup_files",
  "backup_runs",
] as const;

const MAX_FILES_PER_RUN = 400;
const MAX_FILE_BYTES = 100 * 1024 * 1024; // skip anything absurdly large

function driveHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!driveKey) throw new Error("GOOGLE_DRIVE_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
  };
}

async function driveJson(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...driveHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Drive request failed [${res.status}]: ${body}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function escapeQ(value: string) {
  return value.replace(/'/g, "\\'");
}

async function ensureFolder(name: string, parentId?: string): Promise<string> {
  const q = [
    `name='${escapeQ(name)}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ].join(" and ");
  const found = (await driveJson(
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name)")}&pageSize=1`,
  )) as { files?: { id: string }[] };
  if (found.files?.length) return found.files[0]!.id;

  const created = (await driveJson(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })) as { id: string };
  return created.id;
}

async function uploadToDrive(opts: {
  name: string;
  parentId: string;
  mimeType: string;
  body: Blob;
}): Promise<string> {
  const boundary = `lovable${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: opts.name, parents: [opts.parentId] });
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const multipart = new Blob([pre, opts.body, post]);

  const res = await fetch(
    `${GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        ...driveHeaders(),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Drive upload failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

// Copy one storage file to Drive in fixed-size pieces (Drive resumable upload +
// ranged storage reads) so a run never holds a whole archive master in memory.
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024; // must be a multiple of 256 KiB

async function copyStorageFileToDrive(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  bucket: string;
  path: string;
  size: number;
  name: string;
  parentId: string;
}): Promise<string> {
  const { data: signed, error: signError } = await opts.admin.storage
    .from(opts.bucket)
    .createSignedUrl(opts.path, 60 * 30);
  if (signError || !signed?.signedUrl) {
    throw new Error(`Could not read ${opts.bucket}/${opts.path}: ${signError?.message ?? "no URL"}`);
  }
  const total = opts.size;
  const mimeType = guessMime(opts.path);

  const init = await fetch(`${GATEWAY}/upload/drive/v3/files?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      ...driveHeaders(),
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(total),
    },
    body: JSON.stringify({ name: opts.name, parents: [opts.parentId] }),
  });
  if (!init.ok) {
    throw new Error(`Google Drive upload start failed [${init.status}]: ${await init.text()}`);
  }
  const location = init.headers.get("location");
  if (!location) throw new Error("Google Drive upload start returned no session URL");
  const session = new URL(location);
  const sessionUrl = `${GATEWAY}${session.pathname}${session.search}`;

  for (let start = 0; start < total; start += UPLOAD_CHUNK_BYTES) {
    const end = Math.min(start + UPLOAD_CHUNK_BYTES, total); // exclusive
    const src = await fetch(signed.signedUrl, { headers: { Range: `bytes=${start}-${end - 1}` } });
    if (!src.ok) throw new Error(`Reading ${opts.bucket}/${opts.path} failed [${src.status}]`);
    let chunk = new Uint8Array(await src.arrayBuffer());
    // A server that ignores Range returns the whole file; slice defensively.
    if (src.status === 200 && chunk.byteLength > end - start) chunk = chunk.slice(start, end);
    if (chunk.byteLength !== end - start) {
      throw new Error(`Reading ${opts.bucket}/${opts.path} returned an unexpected size`);
    }
    const put = await fetch(sessionUrl, {
      method: "PUT",
      redirect: "manual",
      headers: { ...driveHeaders(), "Content-Range": `bytes ${start}-${end - 1}/${total}` },
      body: chunk,
    });
    const text = await put.text();
    if (put.status === 308) continue;
    if (!put.ok) throw new Error(`Google Drive upload failed [${put.status}]: ${text}`);
    return (JSON.parse(text) as { id: string }).id;
  }
  throw new Error(`Google Drive upload of ${opts.path} did not complete`);
}

function guessMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    tif: "image/tiff",
    tiff: "image/tiff",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

async function deleteDriveFile(fileId: string): Promise<void> {
  const res = await fetch(`${GATEWAY}/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: driveHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Drive delete failed [${res.status}]: ${body}`);
  }
}

async function gzipBytes(bytes: Uint8Array): Promise<ArrayBuffer> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(new CompressionStream("gzip"));
  const response = new Response(stream);
  return response.arrayBuffer();
}

type DumpFile = { id: string; name: string; date: Date };

function parseDumpDate(name: string): Date | null {
  const match = name.match(
    /harrington-archive-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.json\.gz$/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return isNaN(date.getTime()) ? null : date;
}

function selectRetainedDumps(dumps: DumpFile[], now: Date): Set<string> {
  const keep = new Set<string>();
  if (dumps.length === 0) return keep;

  const msPerDay = 24 * 60 * 60 * 1000;
  const sorted = [...dumps].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Always keep the most recent successful dump.
  keep.add(sorted[0]!.id);

  // Group dumps by month and year so we can keep the oldest of each bucket.
  const byMonth = new Map<string, DumpFile[]>();
  const byYear = new Map<string, DumpFile[]>();
  for (const dump of sorted) {
    const monthKey = `${dump.date.getUTCFullYear()}-${String(dump.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const yearKey = String(dump.date.getUTCFullYear());
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(dump);
    if (!byYear.has(yearKey)) byYear.set(yearKey, []);
    byYear.get(yearKey)!.push(dump);
  }

  for (const dump of sorted) {
    const ageDays = Math.floor((now.getTime() - dump.date.getTime()) / msPerDay);
    const monthKey = `${dump.date.getUTCFullYear()}-${String(dump.date.getUTCMonth() + 1).padStart(2, "0")}`;

    if (ageDays <= 30) {
      // Recent daily backups.
      keep.add(dump.id);
    } else if (ageDays <= 365) {
      // One backup per month for the last 12 months (keep the oldest of that month).
      const monthDumps = byMonth.get(monthKey)!;
      keep.add(monthDumps[monthDumps.length - 1]!.id);
    } else {
      // One backup per year forever (keep the oldest of that year).
      const yearDumps = byYear.get(String(dump.date.getUTCFullYear()))!;
      keep.add(yearDumps[yearDumps.length - 1]!.id);
    }
  }

  return keep;
}

async function listDumpFiles(rootId: string): Promise<DumpFile[]> {
  const out: DumpFile[] = [];
  let pageToken: string | undefined;
  const q = encodeURIComponent(
    `'${rootId}' in parents and trashed=false and name contains 'harrington-archive-'`,
  );
  const fields = encodeURIComponent("files(id,name,createdTime)");
  for (;;) {
    const url = `/drive/v3/files?q=${q}&fields=${fields}&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = (await driveJson(url)) as {
      files?: { id: string; name: string; createdTime?: string }[];
      nextPageToken?: string;
    };
    for (const f of res.files ?? []) {
      const date = parseDumpDate(f.name);
      if (date) out.push({ id: f.id, name: f.name, date });
    }
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return out;
}

type StorageObject = { bucket: string; path: string; size: number };

async function* listBucket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  bucket: string,
  prefix = "",
): AsyncGenerator<StorageObject> {
  let offset = 0;
  for (;;) {
    const data = await retryBackupRead(async () => {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`Listing ${bucket}/${prefix} failed: ${error.message}`);
      return data;
    });
    const items = (data ?? []) as {
      name: string;
      id: string | null;
      metadata: { size?: number } | null;
    }[];
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        yield* listBucket(admin, bucket, path);
      } else {
        yield { bucket, path, size: item.metadata?.size ?? 0 };
      }
    }
    if (items.length < 100) break;
    offset += items.length;
  }
}

async function verifyBackupFiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  sampleSize = 200,
): Promise<number> {
  const { data: rows, error } = await admin
    .from("backup_files")
    .select("drive_file_id")
    .limit(sampleSize);
  if (error) throw new Error(`Reading backup_files for verification failed: ${error.message}`);

  let missing = 0;
  for (const row of rows ?? []) {
    const fileId = (row as { drive_file_id: string | null }).drive_file_id;
    if (!fileId) {
      missing++;
      continue;
    }
    const res = await fetch(`${GATEWAY}/drive/v3/files/${fileId}?fields=id`, {
      headers: driveHeaders(),
    });
    if (!res.ok) missing++;
  }
  return missing;
}

export type BackupResult = {
  runId: string;
  status: "success" | "partial" | "error";
  folder: string;
  dbRows: number;
  dbUncompressedBytes: number;
  dbCompressedBytes: number;
  filesUploaded: number;
  filesPending: number;
  bytesUploaded: number;
  retentionDeletedCount: number;
  verificationMissingCount: number;
  error?: string;
};

export async function runBackup(options: { filesOnly?: boolean } = {}): Promise<BackupResult> {
  // filesOnly: catch-up mode — mirror storage files without re-uploading the
  // database dump (the nightly run still produces the full dump).
  const filesOnly = options.filesOnly === true;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const folderName = `db-${stamp}`;

  const { data: runRow, error: runError } = await supabaseAdmin
    .from("backup_runs")
    .insert({ status: "running", drive_folder_name: folderName })
    .select("id")
    .single();
  if (runError) throw new Error(`Could not start backup run: ${runError.message}`);
  const runId = (runRow as { id: string }).id;

  let dbRows = 0;
  let dbUncompressedBytes = 0;
  let dbCompressedBytes = 0;
  let dbDriveFileId: string | null = null;
  let filesUploaded = 0;
  let filesPending = 0;
  let bytesUploaded = 0;
  let retentionDeletedCount = 0;
  let verificationMissingCount = 0;
  let status: BackupResult["status"] = "success";
  let errorMessage: string | undefined;

  try {
    const rootId = await ensureFolder(ROOT_FOLDER);

    if (!filesOnly) {
    // ---- 1. Full database dump as one compressed JSON document ---------------
    const dump: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      const rows: unknown[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select("*")
          .range(from, from + 999);
        if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
        const batch = data ?? [];
        rows.push(...batch);
        if (batch.length < 1000) break;
        from += 1000;
      }
      dump[table] = rows;
      dbRows += rows.length;
    }

    // Compact JSON (no pretty-printing) and encode once to keep peak memory low.
    let encoded: Uint8Array | null = new TextEncoder().encode(
      JSON.stringify({ exported_at: now.toISOString(), tables: dump }),
    );
    for (const key of Object.keys(dump)) delete dump[key];
    dbUncompressedBytes = encoded.byteLength;

    const compressed = await gzipBytes(encoded);
    encoded = null;
    dbCompressedBytes = compressed.byteLength;

    dbDriveFileId = await uploadToDrive({
      name: `harrington-archive-${stamp}.json.gz`,
      parentId: rootId,
      mimeType: "application/gzip",
      body: new Blob([compressed], { type: "application/gzip" }),
    });

    // ---- 2. Rotate old database dumps ---------------------------------------
    try {
      const dumps = await listDumpFiles(rootId);
      const keep = selectRetainedDumps(dumps, now);
      for (const dump of dumps) {
        if (!keep.has(dump.id)) {
          await deleteDriveFile(dump.id);
          retentionDeletedCount++;
        }
      }
    } catch (err) {
      // Retention failure is not fatal: we still have a fresh dump.
      status = status === "success" ? "partial" : status;
      console.error("Backup retention rotation failed:", err);
    }
    }

    // ---- 3. Mirror storage files (incremental) ------------------------------
    const filesRootId = await ensureFolder(FILES_FOLDER, rootId);
    const already = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data: alreadyRows, error: alreadyError } = await supabaseAdmin
        .from("backup_files")
        .select("bucket, storage_path")
        .order("id")
        .range(from, from + 999);
      if (alreadyError) throw new Error(`Reading backup index failed: ${alreadyError.message}`);
      for (const row of alreadyRows ?? []) already.add(`${row.bucket}/${row.storage_path}`);
      if ((alreadyRows ?? []).length < 1000) break;
    }

    // Stream the walk so copies start immediately rather than listing the whole
    // archive first. Leave time to persist results before scheduled HTTP expiry.
    const copyDeadline = Date.now() + 120_000;
    bucketLoop: for (const bucket of BUCKETS) {
      let bucketFolderId: string | null = null;
      for await (const object of listBucket(supabaseAdmin, bucket)) {
        if (Date.now() >= copyDeadline || filesUploaded >= MAX_FILES_PER_RUN) {
          filesPending += 1; // At least one remains; the next run resumes from the index.
          status = "partial";
          break bucketLoop;
        }
        if (already.has(`${object.bucket}/${object.path}`)) continue;
        if (object.size > MAX_FILE_BYTES) {
          filesPending += 1;
          status = "partial";
          continue;
        }
        if (!bucketFolderId) bucketFolderId = await ensureFolder(bucket, filesRootId);
        const driveName = object.path.replace(/\//g, "__");
        let driveFileId: string;
        try {
          if (object.size > 0) {
            // Piece-by-piece copy keeps memory flat even for 100 MB masters.
            driveFileId = await copyStorageFileToDrive({
              admin: supabaseAdmin,
              bucket,
              path: object.path,
              size: object.size,
              name: driveName,
              parentId: bucketFolderId,
            });
          } else {
            // Size unknown/empty: small enough to copy in one go.
            const { data: blob, error: dlError } = await supabaseAdmin.storage
              .from(bucket)
              .download(object.path);
            if (dlError || !blob) throw new Error(dlError?.message ?? "download failed");
            driveFileId = await uploadToDrive({
              name: driveName,
              parentId: bucketFolderId,
              mimeType: blob.type || "application/octet-stream",
              body: blob,
            });
          }
        } catch (err) {
          console.error(`Backup copy of ${bucket}/${object.path} failed:`, err);
          filesPending += 1;
          status = "partial";
          continue;
        }
        const { error: indexError } = await supabaseAdmin.from("backup_files").upsert(
          {
            bucket,
            storage_path: object.path,
            file_size: object.size,
            drive_file_id: driveFileId,
            backed_up_at: new Date().toISOString(),
          },
          { onConflict: "bucket,storage_path" },
        );
        if (indexError) throw new Error(`Saving backup index failed: ${indexError.message}`);
        filesUploaded += 1;
        bytesUploaded += object.size;
      }
    }

    // ---- 4. Monthly verification of a sample of mirrored files ---------------
    if (!filesOnly && now.getUTCDate() === 1) {
      try {
        verificationMissingCount = await verifyBackupFiles(supabaseAdmin, 200);
        if (verificationMissingCount > 0) status = "partial";
      } catch (err) {
        status = "partial";
        console.error("Backup verification failed:", err);
      }
    }
  } catch (err) {
    status = dbDriveFileId ? "partial" : "error";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await supabaseAdmin
    .from("backup_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      db_rows: dbRows,
      db_drive_file_id: dbDriveFileId,
      db_uncompressed_bytes: dbUncompressedBytes,
      db_compressed_bytes: dbCompressedBytes,
      files_uploaded: filesUploaded,
      files_pending: filesPending,
      bytes_uploaded: bytesUploaded,
      retention_deleted_count: retentionDeletedCount,
      verification_missing_count: verificationMissingCount,
      drive_folder_name: ROOT_FOLDER,
      error: errorMessage ?? null,
    })
    .eq("id", runId);

  return {
    runId,
    status,
    folder: ROOT_FOLDER,
    dbRows,
    dbUncompressedBytes,
    dbCompressedBytes,
    filesUploaded,
    filesPending,
    bytesUploaded,
    retentionDeletedCount,
    verificationMissingCount,
    ...(errorMessage ? { error: errorMessage } : {}),
  };
}
