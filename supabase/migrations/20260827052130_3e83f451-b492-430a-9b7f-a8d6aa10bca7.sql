-- Reset counter to reality
UPDATE public.archive_counter c
   SET last_seq = COALESCE((SELECT MAX(l.fh_seq) FROM public.letters l WHERE l.owner_id = c.owner_id), 0),
       updated_at = now();

CREATE OR REPLACE FUNCTION public.preview_next_archive_id()
RETURNS TABLE(fh_seq integer, archive_id text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid UUID := auth.uid(); n INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT GREATEST(
           COALESCE((SELECT c.last_seq FROM public.archive_counter c WHERE c.owner_id = uid), 0),
           COALESCE((SELECT MAX(l.fh_seq) FROM public.letters l WHERE l.owner_id = uid), 0)
         ) + 1
    INTO n;
  RETURN QUERY SELECT n, 'FH' || lpad(n::text, 6, '0');
END; $$;

REVOKE ALL ON FUNCTION public.preview_next_archive_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_next_archive_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_letter(
  p_date_as_written text DEFAULT NULL,
  p_normalized_date date DEFAULT NULL,
  p_date_precision text DEFAULT 'unknown',
  p_date_certainty text DEFAULT 'unknown',
  p_author text DEFAULT NULL,
  p_recipient text DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_destination text DEFAULT NULL,
  p_period text DEFAULT 'unknown',
  p_sheets integer DEFAULT NULL,
  p_has_envelope boolean DEFAULT false,
  p_has_enclosures boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(id uuid, fh_seq integer, archive_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid UUID := auth.uid(); n INTEGER; new_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.archive_counter(owner_id, last_seq)
  VALUES (uid, 0) ON CONFLICT (owner_id) DO NOTHING;
  UPDATE public.archive_counter c
     SET last_seq = GREATEST(c.last_seq, COALESCE((SELECT MAX(l.fh_seq) FROM public.letters l WHERE l.owner_id = uid), 0)) + 1,
         updated_at = now()
   WHERE c.owner_id = uid
  RETURNING c.last_seq INTO n;

  INSERT INTO public.letters(
    owner_id, fh_seq, archive_id, date_as_written, normalized_date, date_precision,
    date_certainty, author, recipient, origin, destination, period, sheets,
    has_envelope, has_enclosures, notes
  ) VALUES (
    uid, n, 'FH' || lpad(n::text, 6, '0'), p_date_as_written, p_normalized_date, p_date_precision,
    p_date_certainty, p_author, p_recipient, p_origin, p_destination, p_period, p_sheets,
    p_has_envelope, p_has_enclosures, p_notes
  ) RETURNING letters.id INTO new_id;

  RETURN QUERY SELECT new_id, n, 'FH' || lpad(n::text, 6, '0');
END; $$;

REVOKE ALL ON FUNCTION public.create_letter(text,date,text,text,text,text,text,text,text,integer,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_letter(text,date,text,text,text,text,text,text,text,integer,boolean,boolean,text) TO authenticated;