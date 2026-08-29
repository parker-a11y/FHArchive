CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden: read-only account'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.require_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_record(p_record_type text, p_subtype text, p_title text, p_date_as_written text, p_normalized_date date, p_date_end date, p_date_precision text, p_date_certainty text, p_primary_person text, p_author text, p_recipient text, p_origin text, p_destination text, p_period text, p_sheets integer, p_has_envelope boolean, p_has_enclosures boolean, p_storage_location text, p_original_copy text, p_notes text)
 RETURNS TABLE(id uuid, fh_seq integer, archive_id text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); n integer; new_id uuid;
BEGIN
  PERFORM public.require_admin();
  INSERT INTO public.archive_counter (owner_id, last_seq)
  VALUES (uid, 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = public.archive_counter.last_seq + 1
  RETURNING last_seq INTO n;

  INSERT INTO public.letters (
    owner_id, fh_seq, archive_id, record_type, subtype, title,
    date_as_written, normalized_date, date_end, date_precision, date_certainty,
    primary_person, author, recipient, origin, destination, period, sheets,
    has_envelope, has_enclosures, storage_location, original_copy, notes
  ) VALUES (
    uid, n, 'FH' || lpad(n::text, 4, '0'),
    COALESCE(p_record_type, 'letter'), p_subtype, p_title,
    p_date_as_written, p_normalized_date, p_date_end,
    COALESCE(p_date_precision, 'unknown'), COALESCE(p_date_certainty, 'unknown'),
    p_primary_person, p_author, p_recipient, p_origin, p_destination,
    COALESCE(p_period, 'unknown'), p_sheets,
    COALESCE(p_has_envelope, false), COALESCE(p_has_enclosures, false),
    p_storage_location, COALESCE(p_original_copy, 'unknown'), p_notes
  ) RETURNING letters.id INTO new_id;

  RETURN QUERY SELECT new_id, n, 'FH' || lpad(n::text, 4, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_digital_source(p_title text, p_source_type text, p_creator text, p_institution text, p_original_date text, p_date_accessed date, p_historical_date_range text, p_url text, p_description text, p_notes text, p_normalized_date date DEFAULT NULL::date, p_date_precision text DEFAULT 'unknown'::text)
 RETURNS TABLE(id uuid, ds_seq integer, ds_id text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_seq integer; v_id uuid; v_dsid text;
BEGIN
  PERFORM public.require_admin();
  INSERT INTO public.ds_counter (owner_id, last_seq) VALUES (auth.uid(), 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = ds_counter.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;
  v_dsid := 'DS-' || lpad(v_seq::text, 4, '0');
  INSERT INTO public.digital_sources (
    owner_id, ds_seq, ds_id, title, source_type, creator, institution,
    original_date, date_accessed, historical_date_range, url, description, notes,
    normalized_date, date_precision
  ) VALUES (
    auth.uid(), v_seq, v_dsid, p_title, p_source_type, p_creator, p_institution,
    p_original_date, p_date_accessed, p_historical_date_range, p_url, p_description, p_notes,
    p_normalized_date, COALESCE(p_date_precision, 'unknown')
  ) RETURNING digital_sources.id INTO v_id;
  RETURN QUERY SELECT v_id, v_seq, v_dsid;
END $function$;

CREATE OR REPLACE FUNCTION public.create_source_container(p_title text, p_container_type text DEFAULT 'box'::text, p_description text DEFAULT NULL::text, p_inscriptions text DEFAULT NULL::text, p_condition text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_processing_status text DEFAULT 'unprocessed'::text, p_date_photographed date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, box_seq integer, box_id text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_seq integer; v_id uuid; v_box text;
BEGIN
  PERFORM public.require_admin();
  INSERT INTO public.container_counter (owner_id, last_seq) VALUES (auth.uid(), 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = container_counter.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;
  v_box := 'BOX-' || lpad(v_seq::text, 3, '0');
  INSERT INTO public.source_containers (
    owner_id, box_seq, box_id, title, container_type, description,
    inscriptions, condition, notes, processing_status, date_photographed
  ) VALUES (
    auth.uid(), v_seq, v_box, p_title, COALESCE(p_container_type,'box'), p_description,
    p_inscriptions, p_condition, p_notes, COALESCE(p_processing_status,'unprocessed'), p_date_photographed
  ) RETURNING source_containers.id INTO v_id;
  RETURN QUERY SELECT v_id, v_seq, v_box;
END $function$;

CREATE OR REPLACE FUNCTION public.next_archive_id()
 RETURNS TABLE(fh_seq integer, archive_id text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid UUID := auth.uid(); n INTEGER;
BEGIN
  PERFORM public.require_admin();
  INSERT INTO public.archive_counter(owner_id, last_seq)
  VALUES (uid, 0) ON CONFLICT (owner_id) DO NOTHING;
  UPDATE public.archive_counter c
     SET last_seq = GREATEST(c.last_seq, COALESCE((SELECT MAX(l.fh_seq) FROM public.letters l WHERE l.owner_id = uid), 0)) + 1,
         updated_at = now()
   WHERE c.owner_id = uid
  RETURNING c.last_seq INTO n;
  RETURN QUERY SELECT n, 'FH' || lpad(n::text, 6, '0');
END; $function$;

DROP FUNCTION IF EXISTS public.create_letter(text, date, text, text, text, text, text, text, text, integer, boolean, boolean, text);
DROP FUNCTION IF EXISTS public.create_digital_source(text, text, text, text, text, date, text, text, text, text);

REVOKE EXECUTE ON FUNCTION public.preview_next_archive_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_next_ds_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_next_archive_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_next_ds_id() TO authenticated;