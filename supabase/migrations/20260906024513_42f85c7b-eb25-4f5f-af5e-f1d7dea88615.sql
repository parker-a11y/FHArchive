REVOKE EXECUTE ON FUNCTION public.preview_next_archive_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.preview_next_archive_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_next_archive_id() TO authenticated, service_role;