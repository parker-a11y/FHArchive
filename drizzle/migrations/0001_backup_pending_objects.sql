CREATE OR REPLACE FUNCTION public.backup_pending_objects(_limit int DEFAULT 400)
RETURNS TABLE(bucket text, path text, size bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT o.bucket_id::text, o.name::text, COALESCE((o.metadata->>'size')::bigint, 0)
  FROM storage.objects o
  WHERE o.bucket_id IN ('scans','ds-files')
    AND NOT EXISTS (SELECT 1 FROM public.backup_files b WHERE b.bucket = o.bucket_id AND b.storage_path = o.name)
  ORDER BY o.bucket_id, o.name
  LIMIT _limit
$$;
REVOKE ALL ON FUNCTION public.backup_pending_objects(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_pending_objects(int) TO service_role;