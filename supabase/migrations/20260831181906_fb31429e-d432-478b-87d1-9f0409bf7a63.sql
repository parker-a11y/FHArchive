ALTER TABLE public.digital_sources
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'needed';

ALTER TABLE public.digital_sources
  DROP CONSTRAINT IF EXISTS digital_sources_transcription_status_check;
ALTER TABLE public.digital_sources
  ADD CONSTRAINT digital_sources_transcription_status_check
  CHECK (transcription_status IN ('needed','complete','not_required'));

UPDATE public.digital_sources
   SET transcription_status = 'complete'
 WHERE COALESCE(btrim(transcript), '') <> '' AND transcription_status = 'needed';

CREATE OR REPLACE FUNCTION public.sync_letter_transcription_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE target uuid;
BEGIN
  target := COALESCE(NEW.letter_id, OLD.letter_id);
  UPDATE public.letters l
     SET transcription_status = CASE
       WHEN c.total > 0 AND c.verified = c.total THEN 'human_verified'
       WHEN c.total > 0 THEN 'ai_transcribed'
       ELSE l.transcription_status
     END
    FROM (
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE status = 'human_verified')::int AS verified
        FROM public.scan_transcriptions s
       WHERE s.letter_id = target
    ) c
   WHERE l.id = target
     AND l.transcription_status <> 'not_required'
     AND c.total > 0
     AND l.transcription_status IS DISTINCT FROM CASE
       WHEN c.verified = c.total THEN 'human_verified'
       ELSE 'ai_transcribed'
     END;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_archive(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_records', (SELECT count(*) FROM public.letters),
    'by_type', COALESCE((SELECT jsonb_object_agg(record_type, n) FROM (SELECT record_type, count(*) AS n FROM public.letters GROUP BY record_type) t), '{}'::jsonb),
    'by_period', COALESCE((SELECT jsonb_object_agg(period, n) FROM (SELECT period, count(*) AS n FROM public.letters GROUP BY period) t), '{}'::jsonb),
    'transcribed', (SELECT count(*) FROM public.letters WHERE transcription_status = 'human_verified'),
    'needs_transcription', (SELECT count(*) FROM public.letters WHERE transcription_status NOT IN ('human_verified','not_required')),
    'transcription_not_required', (SELECT count(*) FROM public.letters WHERE transcription_status = 'not_required'),
    'sources_needs_transcription', (SELECT count(*) FROM public.digital_sources WHERE transcription_status = 'needed'),
    'uncertain_dates', (SELECT count(*) FROM public.letters WHERE NOT (date_certainty = 'confirmed' AND date_precision = 'exact')),
    'total_scans', (SELECT count(*) FROM public.digital_files),
    'letters_with_files', (SELECT count(DISTINCT letter_id) FROM public.digital_files),
    'starred_records', (SELECT count(*) FROM public.letters WHERE starred),
    'starred_sources', (SELECT count(*) FROM public.digital_sources WHERE starred)
  ) INTO v;
  RETURN v;
END $function$;