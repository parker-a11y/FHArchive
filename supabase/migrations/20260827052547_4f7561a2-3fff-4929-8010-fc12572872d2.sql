DROP FUNCTION IF EXISTS public.create_letter(text, date, text, text, text, text, text, text, text, integer, boolean, boolean, text);
DROP FUNCTION IF EXISTS public.preview_next_archive_id();

CREATE OR REPLACE FUNCTION public.preview_next_archive_id()
RETURNS TABLE(fh_seq integer, archive_id text)
LANGUAGE sql
STABLE
STRICT
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.last_seq + 1, 'FH' || lpad((c.last_seq + 1)::text, 4, '0')
  FROM public.archive_counter c
  WHERE c.owner_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.create_letter(
  p_date_as_written text,
  p_normalized_date date,
  p_date_precision text,
  p_date_certainty text,
  p_author text,
  p_recipient text,
  p_origin text,
  p_destination text,
  p_period text,
  p_sheets integer,
  p_has_envelope boolean,
  p_has_enclosures boolean,
  p_notes text
)
RETURNS TABLE(id uuid, fh_seq integer, archive_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  n integer;
  new_id uuid;
BEGIN
  INSERT INTO public.archive_counter (owner_id, last_seq)
  VALUES (uid, 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = public.archive_counter.last_seq + 1
  RETURNING last_seq INTO n;

  INSERT INTO public.letters (
    owner_id, fh_seq, archive_id, date_as_written, normalized_date, date_precision,
    date_certainty, author, recipient, origin, destination, period, sheets,
    has_envelope, has_enclosures, notes
  ) VALUES (
    uid, n, 'FH' || lpad(n::text, 4, '0'), p_date_as_written, p_normalized_date, p_date_precision,
    p_date_certainty, p_author, p_recipient, p_origin, p_destination, p_period, p_sheets,
    p_has_envelope, p_has_enclosures, p_notes
  ) RETURNING letters.id INTO new_id;

  RETURN QUERY SELECT new_id, n, 'FH' || lpad(n::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_next_archive_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_letter(text, date, text, text, text, text, text, text, text, integer, boolean, boolean, text) TO authenticated;