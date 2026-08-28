// Server-only backup engine: dumps the whole database to JSON and mirrors every
// storage file (scans + digital source uploads) to Google Drive.

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

const ROOT_FOLDER = "Harrington Family Archive Backups";
const FILES_FOLDER = "files";
const BUCKETS = ["scans", "ds-files"] as const;

// Every table that must be recreatable from a backup.
const TABLES = [
  "letters",
  "letter_items",
  "letter_scans",
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

type StorageObject = { bucket: string; path: string; size: number };

async function listBucket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  bucket: string,
  prefix = "",
): Promise<StorageObject[]> {
  const out: StorageObject[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Listing ${bucket}/${prefix} failed: ${error.message}`);
    const items = (data ?? []) as {
      name: string;
      id: string | null;
      metadata: { size?: number } | null;
    }[];
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        out.push(...(await listBucket(admin, bucket, path)));
      } else {
        out.push({ bucket, path, size: item.metadata?.size ?? 0 });
      }
    }
    if (items.length < 100) break;
    offset += items.length;
  }
  return out;
}

export type BackupResult = {
  runId: string;
  status: "success" | "partial" | "error";
  folder: string;
  dbRows: number;
  filesUploaded: number;
  filesPending: number;
  bytesUploaded: number;
  error?: string;
};

export async function runBackup(): Promise<BackupResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Keep the scheduled job's credential in sync so the nightly cron can call
  // this endpoint. Stored in a service-role-only table.
  const cronSecret = process.env["LOVABLE_CRON_SECRET"];
  if (cronSecret) {
    await supabaseAdmin
      .from("job_config")
      .upsert(
        { key: "cron_secret", value: cronSecret, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const folderName = `db-${stamp}`;

  const { data: runRow, error: runError } = await supabaseAdmin
    .from("backup_runs")
    .insert({ status: "running", drive_folder_name: folderName })
    .select("id")
    .single();
  if (runError) throw new Error(`Could not start backup run: ${runError.message}`);
  const runId = (runRow as { id: string }).id;

  let dbRows = 0;
  let filesUploaded = 0;
  let filesPending = 0;
  let bytesUploaded = 0;
  let status: BackupResult["status"] = "success";
  let errorMessage: string | undefined;

  try {
    const rootId = await ensureFolder(ROOT_FOLDER);

    // ---- 1. Full database dump as one JSON document -------------------------
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

    const payload = JSON.stringify(
      { exported_at: new Date().toISOString(), tables: dump },
      null,
      2,
    );
    await uploadToDrive({
      name: `harrington-archive-${stamp}.json`,
      parentId: rootId,
      mimeType: "application/json",
      body: new Blob([payload], { type: "application/json" }),
    });

    // ---- 2. Mirror storage files (incremental) ------------------------------
    const filesRootId = await ensureFolder(FILES_FOLDER, rootId);
    const { data: alreadyRows, error: alreadyError } = await supabaseAdmin
      .from("backup_files")
      .select("bucket, storage_path");
    if (alreadyError) throw new Error(`Reading backup index failed: ${alreadyError.message}`);
    const already = new Set(
      (alreadyRows ?? []).map(
        (r: { bucket: string; storage_path: string }) => `${r.bucket}/${r.storage_path}`,
      ),
    );

    for (const bucket of BUCKETS) {
      const objects = await listBucket(supabaseAdmin, bucket);
      const missing = objects.filter((o) => !already.has(`${o.bucket}/${o.path}`));
      const bucketFolderId = missing.length
        ? await ensureFolder(bucket, filesRootId)
        : null;

      for (const object of missing) {
        if (filesUploaded >= MAX_FILES_PER_RUN) {
          filesPending += 1;
          status = "partial";
          continue;
        }
        if (object.size > MAX_FILE_BYTES) {
          filesPending += 1;
          status = "partial";
          continue;
        }
        const { data: blob, error: dlError } = await supabaseAdmin.storage
          .from(bucket)
          .download(object.path);
        if (dlError || !blob) {
          filesPending += 1;
          status = "partial";
          continue;
        }
        const driveFileId = await uploadToDrive({
          name: object.path.replace(/\//g, "__"),
          parentId: bucketFolderId!,
          mimeType: blob.type || "application/octet-stream",
          body: blob,
        });
        await supabaseAdmin.from("backup_files").upsert(
          {
            bucket,
            storage_path: object.path,
            file_size: object.size,
            drive_file_id: driveFileId,
            backed_up_at: new Date().toISOString(),
          },
          { onConflict: "bucket,storage_path" },
        );
        filesUploaded += 1;
        bytesUploaded += object.size;
      }
    }
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await supabaseAdmin
    .from("backup_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      db_rows: dbRows,
      files_uploaded: filesUploaded,
      files_pending: filesPending,
      bytes_uploaded: bytesUploaded,
      drive_folder_name: ROOT_FOLDER,
      error: errorMessage ?? null,
    })
    .eq("id", runId);

  return {
    runId,
    status,
    folder: ROOT_FOLDER,
    dbRows,
    filesUploaded,
    filesPending,
    bytesUploaded,
    ...(errorMessage ? { error: errorMessage } : {}),
  };
}
