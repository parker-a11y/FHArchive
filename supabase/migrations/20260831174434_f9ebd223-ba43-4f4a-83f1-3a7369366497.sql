CREATE TABLE public.record_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT public.archive_owner_id(),
  a_kind text NOT NULL CHECK (a_kind IN ('letter','source')),
  a_id uuid NOT NULL,
  b_kind text NOT NULL CHECK (b_kind IN ('letter','source')),
  b_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT record_links_not_self CHECK (NOT (a_kind = b_kind AND a_id = b_id))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_links TO authenticated;
GRANT ALL ON public.record_links TO service_role;

ALTER TABLE public.record_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved users can read" ON public.record_links FOR SELECT TO authenticated USING (public.can_read_archive(auth.uid()));
CREATE POLICY "own record_links" ON public.record_links FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "archivists insert" ON public.record_links FOR INSERT TO authenticated WITH CHECK (public.is_approved_archivist(auth.uid()));
CREATE POLICY "archivists update" ON public.record_links FOR UPDATE TO authenticated USING (public.is_approved_archivist(auth.uid())) WITH CHECK (public.is_approved_archivist(auth.uid()));
CREATE POLICY "admin only insert" ON public.record_links FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin only update" ON public.record_links FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin only delete" ON public.record_links FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.normalize_record_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tk text; ti uuid;
BEGIN
  IF (NEW.a_kind || NEW.a_id::text) > (NEW.b_kind || NEW.b_id::text) THEN
    tk := NEW.a_kind; ti := NEW.a_id;
    NEW.a_kind := NEW.b_kind; NEW.a_id := NEW.b_id;
    NEW.b_kind := tk; NEW.b_id := ti;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_links_normalize
BEFORE INSERT OR UPDATE ON public.record_links
FOR EACH ROW EXECUTE FUNCTION public.normalize_record_link();

CREATE UNIQUE INDEX record_links_pair_uidx ON public.record_links (a_kind, a_id, b_kind, b_id);
CREATE INDEX record_links_a_idx ON public.record_links (a_id);
CREATE INDEX record_links_b_idx ON public.record_links (b_id);

CREATE OR REPLACE FUNCTION public.cleanup_record_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.record_links WHERE a_id = OLD.id OR b_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER letters_cleanup_record_links
AFTER DELETE ON public.letters
FOR EACH ROW EXECUTE FUNCTION public.cleanup_record_links();

CREATE TRIGGER digital_sources_cleanup_record_links
AFTER DELETE ON public.digital_sources
FOR EACH ROW EXECUTE FUNCTION public.cleanup_record_links();

CREATE OR REPLACE FUNCTION public.search_archive_records(p_q text DEFAULT NULL, p_limit integer DEFAULT 25)
RETURNS TABLE (
  kind text,
  id uuid,
  ref text,
  title text,
  date_text text,
  sort_date date,
  type_label text,
  collection text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (SELECT nullif(btrim(coalesce(p_q,'')), '') AS t)
  SELECT * FROM (
    SELECT
      'letter'::text AS kind,
      l.id,
      l.archive_id AS ref,
      coalesce(nullif(l.title,''),
        nullif(concat_ws(' ', nullif(l.author,''), CASE WHEN l.recipient IS NOT NULL AND l.recipient <> '' THEN 'to ' || l.recipient END), ''),
        l.archive_id) AS title,
      coalesce(nullif(l.date_as_written,''), to_char(l.normalized_date,'FMMonth FMDD, YYYY'), '') AS date_text,
      coalesce(l.sort_date, l.normalized_date) AS sort_date,
      coalesce(nullif(l.subtype,''), l.record_type) AS type_label,
      'Physical Archive'::text AS collection
    FROM public.letters l, q
    WHERE q.t IS NULL OR (
      l.archive_id ILIKE '%'||q.t||'%'
      OR coalesce(l.title,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.author,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.recipient,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.primary_person,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.record_type,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.subtype,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.date_as_written,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.normalized_date::text,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.summary_short,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.notes,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.transcription_verified,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.transcription_raw_ai,'') ILIKE '%'||q.t||'%'
      OR coalesce(l.ocr_text,'') ILIKE '%'||q.t||'%'
      OR EXISTS (SELECT 1 FROM public.letter_people lp JOIN public.people p ON p.id = lp.person_id WHERE lp.letter_id = l.id AND p.name ILIKE '%'||q.t||'%')
      OR EXISTS (SELECT 1 FROM public.letter_keywords lk JOIN public.keywords k ON k.id = lk.keyword_id WHERE lk.letter_id = l.id AND k.name ILIKE '%'||q.t||'%')
      OR EXISTS (SELECT 1 FROM public.letter_events le JOIN public.events e ON e.id = le.event_id WHERE le.letter_id = l.id AND e.name ILIKE '%'||q.t||'%')
    )
    UNION ALL
    SELECT
      'source'::text,
      s.id,
      s.ds_id,
      s.title,
      coalesce(nullif(s.original_date,''), to_char(s.normalized_date,'FMMonth FMDD, YYYY'), nullif(s.historical_date_range,''), ''),
      s.normalized_date,
      s.source_type,
      'Digital Archive'::text
    FROM public.digital_sources s, q
    WHERE q.t IS NULL OR (
      s.ds_id ILIKE '%'||q.t||'%'
      OR coalesce(s.title,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.creator,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.institution,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.source_type,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.original_date,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.historical_date_range,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.normalized_date::text,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.description,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.notes,'') ILIKE '%'||q.t||'%'
      OR coalesce(s.transcript,'') ILIKE '%'||q.t||'%'
      OR EXISTS (SELECT 1 FROM public.ds_people dp JOIN public.people p ON p.id = dp.person_id WHERE dp.source_id = s.id AND p.name ILIKE '%'||q.t||'%')
      OR EXISTS (SELECT 1 FROM public.ds_keywords dk JOIN public.keywords k ON k.id = dk.keyword_id WHERE dk.source_id = s.id AND k.name ILIKE '%'||q.t||'%')
      OR EXISTS (SELECT 1 FROM public.ds_events de JOIN public.events e ON e.id = de.event_id WHERE de.source_id = s.id AND e.name ILIKE '%'||q.t||'%')
    )
  ) r
  ORDER BY r.ref
  LIMIT greatest(coalesce(p_limit,25), 1);
$$;

REVOKE ALL ON FUNCTION public.search_archive_records(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.search_archive_records(text, integer) TO authenticated;