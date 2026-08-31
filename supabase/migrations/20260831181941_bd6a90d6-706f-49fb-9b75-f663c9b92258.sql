CREATE OR REPLACE FUNCTION public.search_letters(
  p_q text DEFAULT NULL, p_type text DEFAULT NULL, p_subtype text DEFAULT NULL, p_period text DEFAULT NULL,
  p_tstatus text DEFAULT NULL, p_review text DEFAULT NULL, p_scan text DEFAULT NULL, p_uncertain boolean DEFAULT false,
  p_id_status text DEFAULT NULL, p_date_precision text DEFAULT NULL, p_dig_status text DEFAULT NULL,
  p_tones text[] DEFAULT NULL, p_view text DEFAULT NULL, p_research text DEFAULT NULL, p_person uuid DEFAULT NULL,
  p_org uuid DEFAULT NULL, p_event uuid DEFAULT NULL, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL,
  p_author text DEFAULT NULL, p_recipient text DEFAULT NULL, p_place text DEFAULT NULL, p_sort text DEFAULT 'fh_seq',
  p_dir text DEFAULT 'asc', p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_starred boolean DEFAULT false,
  p_salutation text DEFAULT NULL, p_addressee text DEFAULT NULL, p_closing text DEFAULT NULL, p_signature text DEFAULT NULL)
RETURNS TABLE(total_count bigint, letter letters)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tstatus text := p_tstatus;
BEGIN
  IF v_tstatus = 'needs' THEN
    v_tstatus := NULL;
  END IF;

  RETURN QUERY
  SELECT s.total_count, s.letter
    FROM public.search_letters(
      p_q, p_type, p_subtype, p_period, v_tstatus, p_review, p_scan, p_uncertain, p_id_status, p_date_precision,
      p_dig_status, p_tones, p_view, p_research, p_person, p_org, p_event, p_date_from, p_date_to, p_author,
      p_recipient, p_place, p_sort, p_dir, p_limit, p_offset, p_starred, p_salutation, p_addressee, p_closing, p_signature) s;
END $function$;