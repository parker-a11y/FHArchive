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
     AND c.total > 0
     AND l.transcription_status IS DISTINCT FROM CASE
       WHEN c.verified = c.total THEN 'human_verified'
       ELSE 'ai_transcribed'
     END;
  RETURN NULL;
END $function$;

CREATE TRIGGER scan_transcriptions_sync_status
AFTER INSERT OR UPDATE OR DELETE ON public.scan_transcriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_letter_transcription_status();

-- One-time backfill: records whose scan transcriptions are all human verified.
UPDATE public.letters l
   SET transcription_status = 'human_verified'
  WHERE EXISTS (SELECT 1 FROM public.scan_transcriptions s WHERE s.letter_id = l.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.scan_transcriptions s
       WHERE s.letter_id = l.id AND s.status <> 'human_verified'
    )
    AND l.transcription_status <> 'human_verified';