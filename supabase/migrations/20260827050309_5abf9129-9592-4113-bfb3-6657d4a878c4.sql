REVOKE ALL ON FUNCTION public.next_archive_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_archive_id() TO authenticated;