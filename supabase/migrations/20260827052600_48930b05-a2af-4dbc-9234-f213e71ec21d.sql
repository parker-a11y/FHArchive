REVOKE ALL ON FUNCTION public.preview_next_archive_id() FROM anon, public;
REVOKE ALL ON FUNCTION public.create_letter(text, date, text, text, text, text, text, text, text, integer, boolean, boolean, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.next_archive_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.preview_next_archive_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_letter(text, date, text, text, text, text, text, text, text, integer, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_archive_id() TO authenticated;