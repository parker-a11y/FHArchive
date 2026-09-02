-- Envelope scans (front/back) no longer block a record from being
-- considered human_verified: they are excluded from the verified/total
-- counts in the transcription-status roll-up.
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
             count(*) FILTER (WHERE s.status = 'human_verified')::int AS verified
        FROM public.scan_transcriptions s
        JOIN public.digital_files f ON f.id = s.file_id
       WHERE s.letter_id = target
         -- envelope pages never gate verification
         AND lower(coalesce(s.page_label,'') || ' ' || coalesce(f.label,'') || ' ' || coalesce(f.original_filename,'')) NOT LIKE '%envelope%'
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

-- Re-evaluate records that are currently stuck at ai_transcribed: if every
-- non-envelope scan is already human_verified, promote them now.
UPDATE public.letters l
   SET transcription_status = 'human_verified'
  WHERE l.transcription_status = 'ai_transcribed'
    AND EXISTS (
      SELECT 1 FROM public.scan_transcriptions s
      JOIN public.digital_files f ON f.id = s.file_id
      WHERE s.letter_id = l.id
        AND lower(coalesce(s.page_label,'') || ' ' || coalesce(f.label,'') || ' ' || coalesce(f.original_filename,'')) NOT LIKE '%envelope%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.scan_transcriptions s
      JOIN public.digital_files f ON f.id = s.file_id
      WHERE s.letter_id = l.id
        AND lower(coalesce(s.page_label,'') || ' ' || coalesce(f.label,'') || ' ' || coalesce(f.original_filename,'')) NOT LIKE '%envelope%'
        AND s.status <> 'human_verified'
    );