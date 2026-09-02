-- The PUBLIC default grant is what leaves these callable by anon.
REVOKE EXECUTE ON FUNCTION public.cleanup_record_links() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_source_container(text,text,text,text,text,text,text,date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_letters(text,text,text,text,text,text,text,boolean,text,text,text,text[],text,text,uuid,uuid,uuid,date,date,text,text,text,text,text,integer,integer,boolean,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_source_container(text,text,text,text,text,text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_letters(text,text,text,text,text,text,text,boolean,text,text,text,text[],text,text,uuid,uuid,uuid,date,date,text,text,text,text,text,integer,integer,boolean,text,text,text,text) TO authenticated;