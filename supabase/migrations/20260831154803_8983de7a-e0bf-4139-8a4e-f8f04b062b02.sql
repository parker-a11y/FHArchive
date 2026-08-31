ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS salutation_as_written text,
  ADD COLUMN IF NOT EXISTS addressee_normalized text,
  ADD COLUMN IF NOT EXISTS closing_as_written text,
  ADD COLUMN IF NOT EXISTS signature_as_written text;

DROP FUNCTION IF EXISTS public.search_letters(text,text,text,text,text,text,text,boolean,text,text,text,text[],text,text,uuid,uuid,uuid,date,date,text,text,text,text,text,integer,integer,boolean);

CREATE OR REPLACE FUNCTION public.search_letters(
  p_q text DEFAULT NULL::text,
  p_type text DEFAULT NULL::text,
  p_subtype text DEFAULT NULL::text,
  p_period text DEFAULT NULL::text,
  p_tstatus text DEFAULT NULL::text,
  p_review text DEFAULT NULL::text,
  p_scan text DEFAULT NULL::text,
  p_uncertain boolean DEFAULT false,
  p_id_status text DEFAULT NULL::text,
  p_date_precision text DEFAULT NULL::text,
  p_dig_status text DEFAULT NULL::text,
  p_tones text[] DEFAULT NULL::text[],
  p_view text DEFAULT NULL::text,
  p_research text DEFAULT NULL::text,
  p_person uuid DEFAULT NULL::uuid,
  p_org uuid DEFAULT NULL::uuid,
  p_event uuid DEFAULT NULL::uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_author text DEFAULT NULL::text,
  p_recipient text DEFAULT NULL::text,
  p_place text DEFAULT NULL::text,
  p_sort text DEFAULT 'fh_seq'::text,
  p_dir text DEFAULT 'asc'::text,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_starred boolean DEFAULT false,
  p_salutation text DEFAULT NULL::text,
  p_addressee text DEFAULT NULL::text,
  p_closing text DEFAULT NULL::text,
  p_signature text DEFAULT NULL::text
)
RETURNS TABLE(total_count bigint, letter letters)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order text;
  v_dir text := CASE WHEN lower(COALESCE(p_dir, 'asc')) = 'desc' THEN 'DESC' ELSE 'ASC' END;
  v_sql text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_archive(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_order := CASE p_sort
    WHEN 'archive_id' THEN 'l.fh_seq'
    WHEN 'record_type' THEN 'l.record_type'
    WHEN 'subtype' THEN 'NULLIF(l.subtype, '''')'
    WHEN 'title' THEN 'NULLIF(l.title, '''')'
    WHEN 'date' THEN 'COALESCE(l.sort_date, l.normalized_date)'
    WHEN 'date_precision' THEN 'l.date_precision'
    WHEN 'identification_status' THEN 'NULLIF(l.identification_status, '''')'
    WHEN 'primary_person' THEN 'NULLIF(l.primary_person, '''')'
    WHEN 'author' THEN 'NULLIF(l.author, '''')'
    WHEN 'recipient' THEN 'NULLIF(l.recipient, '''')'
    WHEN 'origin' THEN 'NULLIF(l.origin, '''')'
    WHEN 'period' THEN 'l.period'
    WHEN 'sheets' THEN 'l.sheets'
    WHEN 'image_count' THEN 'l.image_count'
    WHEN 'digitization_status' THEN 'l.digitization_status'
    WHEN 'scan_status' THEN 'l.scan_status'
    WHEN 'transcription_status' THEN 'l.transcription_status'
    WHEN 'notes' THEN 'NULLIF(l.notes, '''')'
    ELSE 'l.fh_seq'
  END;

  v_sql :=
    'SELECT count(*) OVER () AS total_count, l'
    || ' FROM public.letters l'
    || ' WHERE ($1 IS NULL OR l.record_type = $1)'
    || '   AND ($2 IS NULL OR l.subtype = $2)'
    || '   AND ($3 IS NULL OR l.period = $3)'
    || '   AND ($4 IS NULL OR CASE WHEN $4 LIKE ''!%'' THEN l.transcription_status <> substring($4 from 2) ELSE l.transcription_status = $4 END)'
    || '   AND ($5 IS NULL OR l.review_status = $5)'
    || '   AND ($6 IS NULL OR CASE WHEN $6 = ''has'' THEN l.image_count > 0 WHEN $6 = ''none'' THEN l.image_count = 0 ELSE true END)'
    || '   AND (NOT $7 OR NOT (l.date_certainty = ''confirmed'' AND l.date_precision = ''exact''))'
    || '   AND ($8 IS NULL OR l.identification_status = $8)'
    || '   AND ($9 IS NULL OR l.date_precision = $9)'
    || '   AND ($10 IS NULL OR l.digitization_status = $10)'
    || '   AND ($11 IS NULL OR l.tones @> $11)'
    || '   AND ($12 IS NULL OR CASE'
    || '         WHEN $12 = ''undated'' THEN l.date_precision <> ''not_applicable'' AND (l.normalized_date IS NULL OR l.date_precision IN (''undated'',''approximate'',''range'',''unknown'') OR l.date_certainty IN (''estimated'',''possible'',''unknown''))'
    || '         WHEN $12 = ''unidphoto'' THEN l.record_type = ''photograph'' AND (COALESCE(l.identification_status, '''') <> ''identified'' OR COALESCE(l.primary_person, '''') = '''' OR COALESCE(l.origin, '''') = '''' OR (l.date_precision <> ''not_applicable'' AND (l.normalized_date IS NULL OR l.date_precision IN (''undated'',''approximate'',''range'',''unknown'') OR l.date_certainty IN (''estimated'',''possible'',''unknown''))))'
    || '         ELSE true END)'
    || '   AND ($13 IS NULL OR l.research_status = $13)'
    || '   AND ($14 IS NULL OR EXISTS (SELECT 1 FROM public.letter_people lp WHERE lp.letter_id = l.id AND lp.person_id = $14))'
    || '   AND ($15 IS NULL OR EXISTS (SELECT 1 FROM public.letter_organizations lo WHERE lo.letter_id = l.id AND lo.organization_id = $15))'
    || '   AND ($16 IS NULL OR EXISTS (SELECT 1 FROM public.letter_events le WHERE le.letter_id = l.id AND le.event_id = $16))'
    || '   AND ($17 IS NULL OR (l.normalized_date IS NOT NULL AND l.normalized_date >= $17))'
    || '   AND ($18 IS NULL OR (l.normalized_date IS NOT NULL AND l.normalized_date <= $18))'
    || '   AND ($19 IS NULL OR l.author ILIKE ''%'' || $19 || ''%'' OR EXISTS (SELECT 1 FROM public.letter_people lp JOIN public.people p ON p.id = lp.person_id WHERE lp.letter_id = l.id AND lp.role = ''author'' AND p.name ILIKE ''%'' || $19 || ''%''))'
    || '   AND ($20 IS NULL OR l.recipient ILIKE ''%'' || $20 || ''%'' OR EXISTS (SELECT 1 FROM public.letter_people lp JOIN public.people p ON p.id = lp.person_id WHERE lp.letter_id = l.id AND lp.role = ''recipient'' AND p.name ILIKE ''%'' || $20 || ''%''))'
    || '   AND ($21 IS NULL OR COALESCE(l.origin, '''') || '' '' || COALESCE(l.destination, '''') ILIKE ''%'' || $21 || ''%'')'
    || '   AND (NOT $25 OR l.starred)'
    || '   AND ($26 IS NULL OR COALESCE(l.salutation_as_written, '''') ILIKE ''%'' || $26 || ''%'')'
    || '   AND ($27 IS NULL OR COALESCE(l.addressee_normalized, '''') ILIKE ''%'' || $27 || ''%'')'
    || '   AND ($28 IS NULL OR COALESCE(l.closing_as_written, '''') ILIKE ''%'' || $28 || ''%'')'
    || '   AND ($29 IS NULL OR COALESCE(l.signature_as_written, '''') ILIKE ''%'' || $29 || ''%'')'
    || '   AND ($22 IS NULL OR ('
    || '         l.archive_id ILIKE ''%'' || $22 || ''%'''
    || '      OR l.title ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.subtype, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.primary_person, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.salutation_as_written, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.addressee_normalized, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.closing_as_written, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.signature_as_written, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.author, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.recipient, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.origin, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.destination, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.date_as_written, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.notes, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.summary_short, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.summary_long, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.transcription_verified, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.transcription_raw_ai, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.physical_condition, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.physical_description, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.historical_notes, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.research_notes, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.ocr_text, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.storage_type, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.storage_folder, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR COALESCE(l.storage_location, '''') ILIKE ''%'' || $22 || ''%'''
    || '      OR EXISTS (SELECT 1 FROM unnest(COALESCE(l.tones, ARRAY[]::text[])) t WHERE t ILIKE ''%'' || $22 || ''%'')'
    || '      OR EXISTS (SELECT 1 FROM public.letter_keywords lk JOIN public.keywords k ON k.id = lk.keyword_id WHERE lk.letter_id = l.id AND k.name ILIKE ''%'' || $22 || ''%'')'
    || '      OR EXISTS (SELECT 1 FROM public.letter_people lp JOIN public.people p ON p.id = lp.person_id WHERE lp.letter_id = l.id AND p.name ILIKE ''%'' || $22 || ''%'')'
    || '      OR EXISTS (SELECT 1 FROM public.letter_places lpl JOIN public.places pl ON pl.id = lpl.place_id WHERE lpl.letter_id = l.id AND pl.canonical_name ILIKE ''%'' || $22 || ''%'')'
    || '      OR EXISTS (SELECT 1 FROM public.letter_organizations lo JOIN public.organizations o ON o.id = lo.organization_id WHERE lo.letter_id = l.id AND o.name ILIKE ''%'' || $22 || ''%'')'
    || '      OR EXISTS (SELECT 1 FROM public.letter_events le JOIN public.events e ON e.id = le.event_id WHERE le.letter_id = l.id AND e.name ILIKE ''%'' || $22 || ''%'')'
    || '      OR EXISTS (SELECT 1 FROM public.historical_references hr WHERE hr.letter_id = l.id AND (hr.reference ILIKE ''%'' || $22 || ''%'' OR COALESCE(hr.notes, '''') ILIKE ''%'' || $22 || ''%'' OR COALESCE(hr.description, '''') ILIKE ''%'' || $22 || ''%''))'
    || '      OR EXISTS (SELECT 1 FROM public.scan_transcriptions st WHERE st.letter_id = l.id AND (COALESCE(st.verified_text, '''') ILIKE ''%'' || $22 || ''%'' OR COALESCE(st.ai_text, '''') ILIKE ''%'' || $22 || ''%''))'
    || '   ))'
    || ' ORDER BY ' || v_order || ' ' || v_dir || ' NULLS LAST, l.fh_seq ' || v_dir
    || ' LIMIT $23 OFFSET $24';

  RETURN QUERY EXECUTE v_sql
  USING p_type, p_subtype, p_period, p_tstatus, p_review, p_scan,
        COALESCE(p_uncertain, false), p_id_status, p_date_precision, p_dig_status,
        p_tones, p_view, p_research, p_person, p_org, p_event,
        p_date_from, p_date_to, p_author, p_recipient, p_place,
        NULLIF(btrim(COALESCE(p_q, '')), ''),
        LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500), GREATEST(COALESCE(p_offset, 0), 0),
        COALESCE(p_starred, false),
        NULLIF(btrim(COALESCE(p_salutation, '')), ''),
        NULLIF(btrim(COALESCE(p_addressee, '')), ''),
        NULLIF(btrim(COALESCE(p_closing, '')), ''),
        NULLIF(btrim(COALESCE(p_signature, '')), '');
END $function$;