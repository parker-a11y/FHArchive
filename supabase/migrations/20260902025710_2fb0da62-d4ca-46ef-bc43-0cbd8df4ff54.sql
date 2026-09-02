-- These functions are only used by signed-in archive users; they must not be
-- anonymously callable. RLS-protected authenticated access is unchanged.
REVOKE EXECUTE ON FUNCTION public.cleanup_record_links() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_source_container(text,text,text,text,text,text,text,date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_archive_records(text,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_letters(text,text,text,text,text,text,text,boolean,text,text,text,text[],text,text,uuid,uuid,uuid,date,date,text,text,text,text,text,integer,integer,boolean,text,text,text,text) FROM anon;