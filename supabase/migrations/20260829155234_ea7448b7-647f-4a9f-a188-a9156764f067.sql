REVOKE EXECUTE ON FUNCTION public.create_source_container(text,text,text,text,text,text,text,date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_next_ds_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_next_archive_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_archive_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_letter(text,date,text,text,text,text,text,text,text,integer,boolean,boolean,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_record(text,text,text,text,date,date,text,text,text,text,text,text,text,text,integer,boolean,boolean,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_digital_source(text,text,text,text,text,date,text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_digital_source(text,text,text,text,text,date,text,text,text,text,date,text) FROM anon;