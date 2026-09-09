ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS db_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS db_uncompressed_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS db_compressed_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_deleted_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_missing_count INTEGER NOT NULL DEFAULT 0;

GRANT SELECT, INSERT, UPDATE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

COMMENT ON COLUMN public.backup_runs.db_drive_file_id IS 'Google Drive file id of the compressed database dump';
COMMENT ON COLUMN public.backup_runs.db_uncompressed_bytes IS 'Size of the JSON dump before gzip';
COMMENT ON COLUMN public.backup_runs.db_compressed_bytes IS 'Size of the uploaded gzip dump';
COMMENT ON COLUMN public.backup_runs.retention_deleted_count IS 'Old database dumps removed by retention policy this run';
COMMENT ON COLUMN public.backup_runs.verification_missing_count IS 'Backed-up storage files missing from Drive during monthly verification';
