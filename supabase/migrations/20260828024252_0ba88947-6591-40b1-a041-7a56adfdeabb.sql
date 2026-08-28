CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  destination text NOT NULL DEFAULT 'google_drive',
  drive_folder_id text,
  drive_folder_name text,
  db_rows integer NOT NULL DEFAULT 0,
  files_uploaded integer NOT NULL DEFAULT 0,
  files_pending integer NOT NULL DEFAULT 0,
  bytes_uploaded bigint NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view backup runs" ON public.backup_runs FOR SELECT TO authenticated USING (true);

CREATE TRIGGER backup_runs_updated BEFORE UPDATE ON public.backup_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.backup_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  drive_file_id text,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, storage_path)
);

GRANT SELECT ON public.backup_files TO authenticated;
GRANT ALL ON public.backup_files TO service_role;
ALTER TABLE public.backup_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view backed up files" ON public.backup_files FOR SELECT TO authenticated USING (true);

CREATE TRIGGER backup_files_updated BEFORE UPDATE ON public.backup_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();