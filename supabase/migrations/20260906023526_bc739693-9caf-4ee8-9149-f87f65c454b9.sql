CREATE OR REPLACE FUNCTION public.create_record(p_record_type text, p_subtype text, p_title text, p_date_as_written text, p_normalized_date date, p_date_end date, p_date_precision text, p_date_certainty text, p_primary_person text, p_author text, p_recipient text, p_origin text, p_destination text, p_period text, p_sheets integer, p_has_envelope boolean, p_has_enclosures boolean, p_storage_location text, p_original_copy text, p_notes text)
RETURNS TABLE(id uuid, fh_seq integer, archive_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner uuid; n integer; new_id uuid;
BEGIN
  PERFORM public.require_editor();
  owner := public.archive_owner_id();
  INSERT INTO public.archive_counter (owner_id, last_seq)
  VALUES (owner, 1)
  ON CONFLICT (owner_id) DO UPDATE SET last_seq = public.archive_counter.last_seq + 1
  RETURNING last_seq INTO n;

  INSERT INTO public.letters (
    owner_id, fh_seq, archive_id, record_type, subtype, title,
    date_as_written, normalized_date, date_end, date_precision, date_certainty,
    primary_person, author, recipient, origin, destination, period, sheets,
    has_envelope, has_enclosures, storage_location, original_copy, notes
  ) VALUES (
    owner, n, 'FH' || lpad(n::text, 4, '0'),
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
$$;