CREATE OR REPLACE FUNCTION public.sync_letter_scan_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target uuid;
BEGIN
  target := COALESCE(NEW.letter_id, OLD.letter_id);
  UPDATE public.letters l
     SET image_count = c.n,
         scan_status = CASE WHEN c.n > 0 THEN 'scanned' ELSE 'not_scanned' END
    FROM (SELECT count(*)::int AS n FROM public.digital_files d WHERE d.letter_id = target) c
   WHERE l.id = target
     AND (l.image_count IS DISTINCT FROM c.n
          OR l.scan_status IS DISTINCT FROM CASE WHEN c.n > 0 THEN 'scanned' ELSE 'not_scanned' END);

  IF TG_OP = 'UPDATE' AND NEW.letter_id IS DISTINCT FROM OLD.letter_id THEN
    UPDATE public.letters l
       SET image_count = c.n,
           scan_status = CASE WHEN c.n > 0 THEN 'scanned' ELSE 'not_scanned' END
      FROM (SELECT count(*)::int AS n FROM public.digital_files d WHERE d.letter_id = OLD.letter_id) c
     WHERE l.id = OLD.letter_id;
  END IF;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS digital_files_sync_counts ON public.digital_files;
CREATE TRIGGER digital_files_sync_counts
AFTER INSERT OR UPDATE OR DELETE ON public.digital_files
FOR EACH ROW EXECUTE FUNCTION public.sync_letter_scan_counts();

UPDATE public.letters l
   SET image_count = c.n,
       scan_status = CASE WHEN c.n > 0 THEN 'scanned' ELSE 'not_scanned' END
  FROM (SELECT l2.id, (SELECT count(*)::int FROM public.digital_files d WHERE d.letter_id = l2.id) AS n
          FROM public.letters l2) c
 WHERE l.id = c.id
   AND (l.image_count IS DISTINCT FROM c.n
        OR l.scan_status IS DISTINCT FROM CASE WHEN c.n > 0 THEN 'scanned' ELSE 'not_scanned' END);